import { Pago, PagoDocumento, Documento, Receptor, Emisor, SerieFolio, SolicitudDescargaSat } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { generarXMLPago, firmarXML, timbrarPAC, cancelarCFDIPAC } from '../services/cfdiService.js';
import { generarPDF, generarPDFPagoPreview } from '../services/pdfService.js';
import { 
    solicitarDescargaMasivaSAT, 
    consultarEstatusDescarga, 
    descargarPaqueteXMLs, 
    resolverCredenciales 
} from '../services/descargaSatService.js';
import { parseCFDI } from '../services/xmlParserService.js';
import fs from 'fs';
import path from 'path';
import { STORAGE_BASE, getXmlPath, getPublicUrl } from '../utils/storageHelper.js';

export const getPagos = async (req, res) => {
    const { emisor_id } = req.query;
    try {
        const pagos = await Pago.findAll({
            where: emisor_id ? { emisor_id } : {},
            include: [
                { model: Receptor, attributes: ['razon_social', 'rfc'] },
                {
                    model: Documento,
                    attributes: ['id', 'serie', 'folio', 'uuid', 'fecha', 'total', 'moneda', 'metodo_pago', 'tipo_comprobante', 'estado_pago', 'saldo_insoluto', 'pdf_url', 'xml_url'],
                    through: { attributes: ['num_parcialidad', 'imp_saldo_ant', 'imp_pagado', 'imp_saldo_insoluto'] }
                },
                { model: Documento, as: 'DocumentoREP', attributes: ['id', 'serie', 'folio', 'uuid', 'fecha', 'estado_sat', 'motivo_cancelacion', 'fecha_cancelacion', 'acuse_cancelacion', 'pdf_url', 'xml_url'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(pagos);
    } catch (error) {
        console.error('Error fetching pagos:', error);
        res.status(500).json({ message: 'Error al obtener los pagos registrados' });
    }
};

export const getCartera = async (req, res) => {
    const { emisor_id } = req.query;
    try {
        const documentos = await Documento.findAll({
            where: {
                emisor_id,
                tipo_comprobante: 'I',
                metodo_pago: 'PPD',
                estado_sat: { [Op.ne]: 'Cancelado' },
                [Op.or]: [
                    { saldo_insoluto: { [Op.gt]: 0 } },
                    { saldo_insoluto: null }
                ]
            },
            include: [{ model: Receptor, attributes: ['razon_social', 'rfc'] }],
            order: [['fecha', 'DESC']]
        });

        const totalDeuda = documentos.reduce((acc, d) => {
            const saldo = parseFloat(d.saldo_insoluto !== null ? d.saldo_insoluto : d.total);
            return acc + saldo;
        }, 0);

        res.json({
            totalDeuda,
            count: documentos.length,
            documentos
        });
    } catch (error) {
        console.error('Error fetching cartera:', error);
        res.status(500).json({ message: 'Error al obtener la cartera de clientes' });
    }
};

export const getFacturasPendientes = async (req, res) => {
    const { emisor_id, receptor_id } = req.query;
    try {
        console.log(`[PagoController] Buscando facturas pendientes - Emisor: ${emisor_id}, Receptor: ${receptor_id}`);
        
        const whereClause = {
            emisor_id,
            tipo_comprobante: 'I',
            metodo_pago: 'PPD',
            uuid: { [Op.not]: null }
        };
        
        if (receptor_id) whereClause.receptor_id = receptor_id;

        const documentos = await Documento.findAll({
            where: whereClause,
            include: [{ model: Receptor, attributes: ['razon_social', 'rfc'] }],
            order: [['fecha', 'DESC']]
        });

        // Filtrar manualmente por si acaso el campo estado_pago no está sincronizado
        const filtrados = documentos.filter(d => 
            d.estado_pago !== 'Pagado' && 
            (d.saldo_insoluto > 0 || d.saldo_insoluto === null)
        );

        console.log(`[PagoController] Facturas encontradas: ${documentos.length}, Filtradas: ${filtrados.length}`);
        res.json(filtrados);
    } catch (error) {
        console.error('Error fetching facturas pendientes:', error);
        res.status(500).json({ message: 'Error al obtener facturas con saldo pendiente' });
    }
};

export const registrarPago = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { emisor_id, receptor_id, fecha_pago, monto, forma_pago, moneda, tipo_cambio, facturas } = req.body;

        const validFacturas = [];

        // 2. Asociar facturas y verificar si son timbradas
        for (const f of facturas) {
            const doc = await Documento.findByPk(f.documento_id, { transaction: t });
            if (!doc || !doc.uuid) continue;
            validFacturas.push({f, doc});
        }

        if (validFacturas.length === 0) {
            throw new Error("No hay facturas válidas (timbradas) seleccionadas para registrar el pago.");
        }

        // 3. Crear el registro maestro del Pago
        const nuevoPago = await Pago.create({
            emisor_id,
            receptor_id,
            fecha_pago,
            monto,
            forma_pago,
            moneda: moneda || 'MXN',
            tipo_cambio: tipo_cambio || 1,
            no_operacion: req.body.no_operacion,
            rfc_emisor_cta_ord: req.body.rfc_emisor_cta_ord,
            nom_banco_ord_ext: req.body.nom_banco_ord_ext,
            cta_ordenante: req.body.cta_ordenante,
            rfc_emisor_cta_ben: req.body.rfc_emisor_cta_ben,
            cta_beneficiario: req.body.cta_beneficiario
        }, { transaction: t });

        const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

        for (const {f, doc} of validFacturas) {
            const saldoAnterior = round2(doc.saldo_insoluto !== null ? doc.saldo_insoluto : doc.total);
            const montoAplicado = round2(f.monto_aplicado);
            let nuevoSaldoInsoluto = round2(saldoAnterior - montoAplicado);
            if (nuevoSaldoInsoluto <= 0.009) {
                nuevoSaldoInsoluto = 0;
            }
            
            // Calcular equivalencia_dr: Tipo de cambio del pago si las monedas difieren
            let equivalenciaDR = 1;
            if (nuevoPago.moneda !== doc.moneda) {
                // Si el pago es USD y factura MXN, la equivalencia es el tipo de cambio (ej. 20)
                equivalenciaDR = nuevoPago.tipo_cambio || 1;
            }

            // Determinar número de parcialidad (solo contando pagos activos no cancelados)
            const prevRels = await PagoDocumento.findAll({
                where: { documento_id: doc.id },
                include: [{ model: Pago, where: { estado: { [Op.ne]: 'Cancelado' } }, required: true }],
                order: [['num_parcialidad', 'DESC']],
                transaction: t
            });
            const numParcialidad = prevRels.length > 0 ? prevRels[0].num_parcialidad + 1 : 1;

            await PagoDocumento.create({
                pago_id: nuevoPago.id,
                documento_id: doc.id,
                num_parcialidad: numParcialidad,
                imp_saldo_ant: saldoAnterior,
                imp_pagado: montoAplicado,
                imp_saldo_insoluto: nuevoSaldoInsoluto,
                moneda_dr: doc.moneda,
                equivalencia_dr: equivalenciaDR
            }, { transaction: t });

            // Actualizar documento
            await doc.update({
                saldo_insoluto: nuevoSaldoInsoluto,
                estado_pago: nuevoSaldoInsoluto <= 0 ? 'Pagado' : 'Pago Parcial'
            }, { transaction: t });
        }

        await t.commit();
        res.status(201).json(nuevoPago);
    } catch (error) {
        await t.rollback();
        console.error('Error registrando pago:', error);
        res.status(500).json({ 
            message: 'Error al registrar el pago y actualizar saldos',
            details: error.message
        });
    }
};

export const emitirREP = async (req, res) => {
    const { id } = req.params;
    try {
        const pago = await Pago.findByPk(id, {
            include: [
                { model: Receptor },
                { model: Emisor },
                { model: Documento, through: PagoDocumento }
            ]
        });

        if (!pago) return res.status(404).json({ message: 'Pago no encontrado' });
        if (pago.documento_rep_id) return res.status(400).json({ message: 'Este pago ya tiene un REP emitido' });

        // Obtener los detalles de los documentos relacionados con sus saldos
        const doctosRel = await PagoDocumento.findAll({
            where: { pago_id: pago.id },
            include: [{ model: Documento }]
        });

        // Prevenir intentar timbrar documentos huérfanos de UUID que hayan quedado en caché
        const invalidDocs = doctosRel.filter(dr => !dr.Documento || !dr.Documento.uuid);
        if (invalidDocs.length > 0) {
            return res.status(400).json({ 
                message: 'No se puede timbrar este Pago. Está vinculado a una o más facturas que nunca fueron timbradas (no tienen UUID). Elimina este pago y genera uno nuevo con facturas válidas.' 
            });
        }

        // 1. Generar XML
        const xmlBase = await generarXMLPago(pago, pago.Emisor, pago.Receptor, doctosRel);
        
        // 2. Firmar XML
        const xmlFirmado = await firmarXML(xmlBase, pago.Emisor.id);

        // 3. Timbrar con PAC
        const resultTimbrado = await timbrarPAC(xmlFirmado, pago.Emisor);

        if (resultTimbrado.success) {
            // 4. Crear registro en tabla Documentos como tipo 'P' (Pago)
            const docREP = await Documento.create({
                emisor_id: pago.emisor_id,
                receptor_id: pago.receptor_id,
                usuario_id: req.usuario.id,
                tipo_comprobante: 'P',
                serie: pago.serie || 'P',
                folio: pago.folio || pago.id.toString(),
                fecha: new Date(),
                moneda: 'XXX',
                total: 0,
                subtotal: 0,
                uuid: resultTimbrado.uuid,
                estado_sat: 'Timbrado',
                xml_url: resultTimbrado.xmlTimbradoUrl,
                pdf_url: '', // Se podrá generar después
                no_certificado_emisor: resultTimbrado.noCertificadoEmisor,
                no_certificado_sat: resultTimbrado.noCertificadoSAT,
                fecha_timbrado: resultTimbrado.fechaTimbrado,
                sello_cfdi: resultTimbrado.selloCFDI,
                sello_sat: resultTimbrado.selloSAT,
                cadena_original_tfd: resultTimbrado.cadenaOriginalTFD
            });

            // Actualizar el pago con el ID del documento REP
            await pago.update({ documento_rep_id: docREP.id });

            // 5. Generar PDF del REP
            try {
                const pdfRes = await generarPDF(docREP, pago.Emisor, pago.Receptor, []);
                if (pdfRes.success) {
                    await docREP.update({ pdf_url: pdfRes.pdfUrl });
                }
            } catch (pdfErr) {
                console.error('Error generando PDF de REP:', pdfErr);
            }

            res.json({ success: true, message: 'Pago timbrado correctamente', uuid: resultTimbrado.uuid, documento: docREP });
        } else {
            res.status(500).json({ success: false, message: 'Error al timbrar con el PAC' });
        }

    } catch (error) {
        console.error('Error emitiendo REP:', error);
        res.status(500).json({ message: error.message || 'Error al emitir REP' });
    }
};

export const previewPagoPDF = async (req, res) => {
    try {
        const { emisor_id, receptor_id, fecha_pago, monto, forma_pago, moneda, tipo_cambio, facturas } = req.body;
        
        const previewResult = await generarPDFPagoPreview(emisor_id, receptor_id, {
            fecha_pago,
            monto,
            forma_pago,
            moneda,
            tipo_cambio
        }, facturas);
        
        const previewsDir = path.join(STORAGE_BASE, 'previews');
        if (!fs.existsSync(previewsDir)) {
            fs.mkdirSync(previewsDir, { recursive: true });
        }

        // Clean up old preview files (older than 10 minutes)
        try {
            const files = await fs.promises.readdir(previewsDir);
            const now = Date.now();
            for (const file of files) {
                const filePath = path.join(previewsDir, file);
                const stats = await fs.promises.stat(filePath);
                if (now - stats.mtimeMs > 10 * 60 * 1000) {
                    await fs.promises.unlink(filePath).catch(() => {});
                }
            }
        } catch (cleanupErr) {
            console.error('[PDF Preview] Error cleaning up old previews:', cleanupErr);
        }

        const isHtml = previewResult && previewResult.isHtml;
        const fileData = (previewResult && previewResult.data) ? previewResult.data : previewResult;
        const ext = isHtml ? 'html' : 'pdf';
        const filename = `preview-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const absolutePath = path.join(previewsDir, filename);
        await fs.promises.writeFile(absolutePath, fileData);

        const publicUrl = `/storage/previews/${filename}`;
        res.json({ success: true, pdfUrl: publicUrl, isHtmlFallback: !!isHtml });
    } catch (error) {
        console.error('Error generating PDF preview:', error);
        res.status(500).json({ message: error.message || 'Error al generar la vista previa del PDF' });
    }
};

/**
 * Cancela un Pago (y su CFDI REP tipo 'P' ante el SAT si ya fue timbrado),
 * restaurando automáticamente el saldo insoluto y estado_pago de las facturas de Ingreso asociadas.
 */
export const cancelarPago = async (req, res) => {
    const { id } = req.params;
    const { motivoCancelacion = '02', uuidSustitucion = '' } = req.body;
    const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

    try {
        const pago = await Pago.findByPk(id, {
            include: [
                { model: Emisor },
                { model: Receptor },
                { model: Documento, as: 'DocumentoREP' }
            ]
        });

        if (!pago) {
            return res.status(404).json({ message: 'Pago no encontrado.' });
        }

        if (pago.estado === 'Cancelado') {
            return res.status(400).json({ message: 'Este pago ya se encuentra cancelado.' });
        }

        const uuidSustClean = (uuidSustitucion || '').trim();
        if (motivoCancelacion === '01' && (!uuidSustClean || uuidSustClean.length < 30)) {
            return res.status(400).json({
                message: 'Para el motivo "01 - Comprobante emitido con errores con relación", debes proporcionar el UUID del Complemento de Pago que lo sustituye.'
            });
        }

        let pacResult = { success: true, mensaje: 'Pago cancelado y saldos restaurados.' };

        // 1. Si el pago cuenta con un CFDI REP timbrado ante el SAT, cancelarlo en el PAC
        if (pago.DocumentoREP && pago.DocumentoREP.estado_sat === 'Timbrado' && pago.DocumentoREP.uuid) {
            pacResult = await cancelarCFDIPAC(
                pago.Emisor,
                pago.DocumentoREP.uuid,
                motivoCancelacion,
                motivoCancelacion === '01' ? uuidSustClean : ''
            );

            if (!pacResult.success) {
                return res.status(400).json({
                    success: false,
                    message: pacResult.mensaje || 'El PAC/SAT rechazó la cancelación del Complemento de Pago (REP).'
                });
            }

            await pago.DocumentoREP.update({
                estado_sat: 'Cancelado',
                estado_pago: 'Cancelado',
                motivo_cancelacion: motivoCancelacion,
                uuid_sustitucion: motivoCancelacion === '01' ? uuidSustClean : null,
                fecha_cancelacion: new Date(),
                acuse_cancelacion: pacResult.acuse || null
            });
        } else if (pago.DocumentoREP) {
            await pago.DocumentoREP.update({
                estado_sat: 'Cancelado',
                estado_pago: 'Cancelado',
                motivo_cancelacion: motivoCancelacion,
                fecha_cancelacion: new Date()
            });
        }

        // 2. Marcar el registro de Pago como Cancelado
        await pago.update({
            estado: 'Cancelado',
            motivo_cancelacion: motivoCancelacion,
            fecha_cancelacion: new Date()
        });

        // 3. Restaurar el saldo insoluto de todas las facturas de Ingreso a las que se había aplicado este pago
        const relacionesPago = await PagoDocumento.findAll({
            where: { pago_id: pago.id },
            include: [Documento]
        });

        const facturasRestauradas = [];
        for (const rel of relacionesPago) {
            const fac = rel.Documento;
            if (!fac || fac.estado_sat === 'Cancelado') continue;

            const totalFac = round2(fac.total);
            const saldoActual = round2(fac.saldo_insoluto !== null ? fac.saldo_insoluto : 0);
            const montoAbonado = round2(rel.imp_pagado);
            let nuevoSaldo = Math.min(totalFac, round2(saldoActual + montoAbonado));
            if (totalFac - nuevoSaldo <= 0.009) nuevoSaldo = totalFac;

            const nuevoEstadoPago = nuevoSaldo <= 0
                ? 'Pagado'
                : nuevoSaldo >= totalFac - 0.009
                    ? 'Pendiente'
                    : 'Pago Parcial';

            await fac.update({
                saldo_insoluto: nuevoSaldo,
                estado_pago: nuevoEstadoPago
            });

            facturasRestauradas.push({
                id: fac.id,
                folio: `${fac.serie || 'A'}-${fac.folio || fac.id}`,
                monto_devuelto_a_saldo: montoAbonado,
                saldo_nuevo: nuevoSaldo,
                estado_pago: nuevoEstadoPago
            });
        }

        res.json({
            success: true,
            message: pacResult.mensaje || 'Pago / Complemento REP cancelado y saldos restaurados exitosamente.',
            pago,
            facturasRestauradas
        });
    } catch (error) {
        console.error('Error al cancelar pago:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al cancelar el pago y restaurar saldos.'
        });
    }
};

/**
 * Recalcula el saldo insoluto de una factura emitida (Cuentas por Cobrar).
 */
export const recalcularSaldoFacturaEmitida = async (documentoId) => {
    try {
        const doc = await Documento.findByPk(documentoId);
        if (!doc || doc.tipo_comprobante !== 'I') return;

        if (doc.metodo_pago === 'PUE') {
            doc.saldo_insoluto = 0;
            doc.estado_pago = 'Pagado';
            await doc.save();
            return;
        }

        const pagosDocs = await PagoDocumento.findAll({
            where: { documento_id: documentoId },
            include: [{ model: Pago, where: { estado: { [Op.ne]: 'Cancelado' } }, required: true }]
        });

        const totalPagado = pagosDocs.reduce((acc, pd) => acc + (parseFloat(pd.imp_pagado) || 0), 0);
        const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
        const nuevoSaldo = Math.max(0, round2(parseFloat(doc.total) - totalPagado));

        doc.saldo_insoluto = nuevoSaldo;
        if (nuevoSaldo <= 0.009) {
            doc.saldo_insoluto = 0;
            doc.estado_pago = 'Pagado';
        } else if (totalPagado > 0) {
            doc.estado_pago = 'Pago Parcial';
        } else {
            doc.estado_pago = 'Pendiente';
        }
        await doc.save();
    } catch (err) {
        console.error('Error recalculando saldo de factura emitida:', err);
    }
};

/**
 * Solicita Descarga Masiva de Facturas Emitidas ante el SAT (Cuentas por Cobrar)
 */
export const solicitarDescargaEmitidosSAT = async (req, res) => {
    const { emisor_id, fecha_inicio, fecha_fin, tipo_solicitud = 'CFDI' } = req.body;

    try {
        const emisor = await Emisor.findByPk(emisor_id);
        if (!emisor) {
            return res.status(404).json({ message: 'Emisor del sistema no encontrado' });
        }

        let creds;
        try {
            creds = resolverCredenciales(emisor);
        } catch (cErr) {
            return res.status(400).json({ 
                message: `No se pudieron cargar los certificados de firma (${emisor.rfc}): ${cErr.message}. Verifica que la e.firma (FIEL) esté dada de alta en Emisores.` 
            });
        }

        const params = {
            rfcSolicitante: emisor.rfc,
            rfcEmisor: emisor.rfc,
            fechaInicio: fecha_inicio,
            fechaFin: fecha_fin,
            tipoSolicitud: tipo_solicitud,
            tipoDescarga: 'Emitidos'
        };

        const resultado = await solicitarDescargaMasivaSAT(params, creds);

        const nuevaSolicitud = await SolicitudDescargaSat.create({
            emisor_id: emisor.id,
            id_solicitud_sat: resultado.solicitudId,
            rfc_solicitante: emisor.rfc,
            rfc_receptor: null,
            fecha_inicio,
            fecha_fin,
            tipo_solicitud,
            tipo_descarga: 'Emitidos',
            estado_sat: resultado.estado,
            codigo_estado: resultado.codigoEstado,
            mensaje_sat: resultado.mensaje
        });

        res.json({
            message: resultado.mensaje || 'Solicitud de facturas emitidas enviada al SAT',
            solicitud: nuevaSolicitud,
            resultado
        });
    } catch (error) {
        console.error('Error en solicitarDescargaEmitidosSAT:', error);
        res.status(500).json({ message: error.message || 'Error al conectar con el Web Service del SAT' });
    }
};

/**
 * Obtiene el historial de solicitudes de descarga de emitidas del SAT
 */
export const getSolicitudesEmitidosSAT = async (req, res) => {
    const { emisor_id } = req.query;
    try {
        const whereClause = { tipo_descarga: 'Emitidos' };
        if (emisor_id) whereClause.emisor_id = emisor_id;

        const solicitudes = await SolicitudDescargaSat.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });
        res.json(solicitudes);
    } catch (error) {
        console.error('Error al obtener solicitudes emitidas SAT:', error);
        res.status(500).json({ message: 'Error al consultar historial de solicitudes SAT' });
    }
};

/**
 * Consulta el estatus de la solicitud de descarga de emitidas ante el SAT
 */
export const verificarSolicitudEmitidosSAT = async (req, res) => {
    const { id } = req.params;
    try {
        const solicitud = await SolicitudDescargaSat.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!solicitud) return res.status(404).json({ message: 'Solicitud no encontrada' });

        const emisor = solicitud.Emisor || await Emisor.findByPk(solicitud.emisor_id);
        const creds = resolverCredenciales(emisor);

        const estatus = await consultarEstatusDescarga(solicitud.id_solicitud_sat, emisor.rfc, creds);

        solicitud.estado_sat = estatus.estado;
        solicitud.codigo_estado = estatus.codigoEstado;
        solicitud.mensaje_sat = estatus.mensaje;
        solicitud.numero_cfdis = estatus.numeroCFDIs || solicitud.numero_cfdis;
        if (estatus.paquetesIds && estatus.paquetesIds.length > 0) {
            solicitud.paquetes_ids = estatus.paquetesIds;
        }
        await solicitud.save();

        res.json({ message: estatus.mensaje, solicitud, estatus });
    } catch (error) {
        console.error('Error verificando solicitud emitida SAT:', error);
        res.status(500).json({ message: error.message || 'Error al verificar con el SAT' });
    }
};

/**
 * Descarga los paquetes de CFDI emitidos del SAT e importa clientes, facturas y pagos a la Cartera
 */
export const descargarEImportarEmitidosSAT = async (req, res) => {
    const { id } = req.params;
    try {
        const solicitud = await SolicitudDescargaSat.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!solicitud) return res.status(404).json({ message: 'Solicitud no encontrada' });

        const emisor = solicitud.Emisor || await Emisor.findByPk(solicitud.emisor_id);
        const creds = resolverCredenciales(emisor);

        let paquetes = solicitud.paquetes_ids;
        if (!paquetes || (Array.isArray(paquetes) && paquetes.length === 0)) {
            const estatus = await consultarEstatusDescarga(solicitud.id_solicitud_sat, emisor.rfc, creds);
            if (estatus.paquetesIds && estatus.paquetesIds.length > 0) {
                paquetes = estatus.paquetesIds;
                solicitud.paquetes_ids = paquetes;
                await solicitud.save();
            }
        }

        if (!paquetes || paquetes.length === 0) {
            return res.status(400).json({
                message: `El SAT aún no genera paquetes para esta solicitud (Estatus: ${solicitud.estado_sat}). Verifica en unos minutos.`
            });
        }

        let totalXMLs = 0;
        let facturasImportadas = 0;
        let pagosImportados = 0;
        let erroresImportacion = 0;

        for (const paqId of paquetes) {
            try {
                const archivosXml = await descargarPaqueteXMLs(paqId, emisor.rfc, creds);
                totalXMLs += archivosXml.length;

                for (const item of archivosXml) {
                    try {
                        const cfdiData = await parseCFDI(item.contenidoXml);

                        // Buscar o crear Receptor (Cliente)
                        const [receptor] = await Receptor.findOrCreate({
                            where: { rfc: cfdiData.receptor.rfc, emisor_id: emisor.id },
                            defaults: {
                                razon_social: cfdiData.receptor.nombre || 'Cliente General',
                                regimen_fiscal: cfdiData.receptor.regimenFiscalReceptor || '616',
                                codigo_postal: cfdiData.receptor.domicilioFiscalReceptor || emisor.codigo_postal,
                                uso_cfdi: cfdiData.receptor.usoCfdi || 'G03'
                            }
                        });

                        if (['I', 'E'].includes(cfdiData.tipoComprobante)) {
                            const isPPD = cfdiData.metodoPago === 'PPD';
                            const [doc, created] = await Documento.findOrCreate({
                                where: { uuid: cfdiData.uuid },
                                defaults: {
                                    emisor_id: emisor.id,
                                    receptor_id: receptor.id,
                                    usuario_id: req.usuario?.id || 1,
                                    tipo_comprobante: cfdiData.tipoComprobante,
                                    serie: cfdiData.serie,
                                    folio: cfdiData.folio,
                                    fecha: cfdiData.fecha,
                                    forma_pago: cfdiData.formaPago,
                                    metodo_pago: cfdiData.metodoPago || 'PUE',
                                    uso_cfdi: cfdiData.receptor.usoCfdi || 'G03',
                                    moneda: cfdiData.moneda || 'MXN',
                                    tipo_cambio: cfdiData.tipoCambio || 1,
                                    subtotal: cfdiData.subtotal || cfdiData.total,
                                    descuento: cfdiData.descuento || 0,
                                    total_impuestos_trasladados: 0,
                                    total_impuestos_retenidos: 0,
                                    total: cfdiData.total,
                                    saldo_insoluto: isPPD ? cfdiData.total : 0,
                                    estado_pago: isPPD ? 'Pendiente' : 'Pagado',
                                    uuid: cfdiData.uuid,
                                    estado_sat: 'Timbrado'
                                }
                            });

                            // Guardar archivo XML en disco
                            try {
                                const xmlPath = getXmlPath(emisor.rfc, cfdiData.uuid);
                                fs.writeFileSync(xmlPath, item.contenidoXml, 'utf8');
                                doc.xml_url = getPublicUrl(emisor.rfc, 'xml', `${cfdiData.uuid}.xml`);
                                await doc.save();
                            } catch (wErr) {
                                console.warn('Error guardando XML emitido en disco:', wErr.message);
                            }

                            if (created) facturasImportadas++;
                            await recalcularSaldoFacturaEmitida(doc.id);
                        } else if (cfdiData.tipoComprobante === 'P') {
                            // Complemento de Recepción de Pagos (REP)
                            const [docRep] = await Documento.findOrCreate({
                                where: { uuid: cfdiData.uuid },
                                defaults: {
                                    emisor_id: emisor.id,
                                    receptor_id: receptor.id,
                                    usuario_id: req.usuario?.id || 1,
                                    tipo_comprobante: 'P',
                                    serie: cfdiData.serie,
                                    folio: cfdiData.folio,
                                    fecha: cfdiData.fecha,
                                    forma_pago: '99',
                                    metodo_pago: 'PUE',
                                    moneda: 'XXX',
                                    total: 0,
                                    subtotal: 0,
                                    estado_pago: 'Pagado',
                                    estado_sat: 'Timbrado',
                                    uuid: cfdiData.uuid
                                }
                            });

                            try {
                                const xmlPath = getXmlPath(emisor.rfc, cfdiData.uuid);
                                fs.writeFileSync(xmlPath, item.contenidoXml, 'utf8');
                                docRep.xml_url = getPublicUrl(emisor.rfc, 'xml', `${cfdiData.uuid}.xml`);
                                await docRep.save();
                            } catch (wErr) {}

                            if (cfdiData.pagos && cfdiData.pagos.length > 0) {
                                for (const pItem of cfdiData.pagos) {
                                    const [pago, createdP] = await Pago.findOrCreate({
                                        where: { documento_rep_id: docRep.id, fecha_pago: pItem.fechaPago, monto: pItem.monto },
                                        defaults: {
                                            emisor_id: emisor.id,
                                            receptor_id: receptor.id,
                                            fecha_pago: pItem.fechaPago,
                                            forma_pago: pItem.formaPagoP || '03',
                                            monto: pItem.monto,
                                            moneda: pItem.monedaP || 'MXN',
                                            tipo_cambio: pItem.tipoCambioP || 1,
                                            documento_rep_id: docRep.id
                                        }
                                    });

                                    if (pItem.documentosRelacionados) {
                                        for (const dr of pItem.documentosRelacionados) {
                                            const facRel = await Documento.findOne({ where: { uuid: dr.idDocumento } });
                                            if (facRel) {
                                                await PagoDocumento.findOrCreate({
                                                    where: { pago_id: pago.id, documento_id: facRel.id },
                                                    defaults: {
                                                        pago_id: pago.id,
                                                        documento_id: facRel.id,
                                                        num_parcialidad: dr.numParcialidad || 1,
                                                        imp_saldo_ant: (dr.impSaldoInsoluto || 0) + (dr.impPagado || 0),
                                                        imp_pagado: dr.impPagado,
                                                        imp_saldo_insoluto: dr.impSaldoInsoluto || 0,
                                                        moneda_dr: dr.monedaDR || 'MXN',
                                                        equivalencia_dr: 1
                                                    }
                                                });
                                                await recalcularSaldoFacturaEmitida(facRel.id);
                                            }
                                        }
                                    }
                                    if (createdP) pagosImportados++;
                                }
                            }
                        }
                    } catch (xmlItemErr) {
                        console.error('Error parseando XML emitido individual:', xmlItemErr.message);
                        erroresImportacion++;
                    }
                }
            } catch (paqErr) {
                console.error(`Error procesando paquete emitido ${paqId}:`, paqErr.message);
            }
        }

        solicitud.estado_sat = 'Descargada';
        solicitud.paquetes_descargados = paquetes;
        await solicitud.save();

        res.json({
            message: `Sincronización SAT finalizada: Se procesaron ${totalXMLs} comprobantes (${facturasImportadas} facturas y ${pagosImportados} pagos agregados a Cartera).`,
            totalXMLs,
            facturasImportadas,
            pagosImportados,
            erroresImportacion
        });
    } catch (error) {
        console.error('Error en descargarEImportarEmitidosSAT:', error);
        res.status(500).json({ message: error.message || 'Error al descargar e importar del SAT' });
    }
};

/**
 * Importación manual de lote de XMLs emitidos por arrastre / archivo (Cuentas por Cobrar)
 */
export const importarXmlsEmitidosManual = async (req, res) => {
    const { emisor_id } = req.body;
    try {
        const emisor = await Emisor.findByPk(emisor_id);
        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No se enviaron archivos XML para importar' });
        }

        let facturasImportadas = 0;
        let pagosImportados = 0;
        let errores = 0;

        for (const file of files) {
            try {
                const xmlString = file.buffer.toString('utf8');
                const cfdiData = await parseCFDI(xmlString);

                // Buscar o crear Receptor (Cliente)
                const [receptor] = await Receptor.findOrCreate({
                    where: { rfc: cfdiData.receptor.rfc, emisor_id: emisor.id },
                    defaults: {
                        razon_social: cfdiData.receptor.nombre || 'Cliente General',
                        regimen_fiscal: cfdiData.receptor.regimenFiscalReceptor || '616',
                        codigo_postal: cfdiData.receptor.domicilioFiscalReceptor || emisor.codigo_postal,
                        uso_cfdi: cfdiData.receptor.usoCfdi || 'G03'
                    }
                });

                if (['I', 'E'].includes(cfdiData.tipoComprobante)) {
                    const isPPD = cfdiData.metodoPago === 'PPD';
                    const [doc, created] = await Documento.findOrCreate({
                        where: { uuid: cfdiData.uuid },
                        defaults: {
                            emisor_id: emisor.id,
                            receptor_id: receptor.id,
                            usuario_id: req.usuario?.id || 1,
                            tipo_comprobante: cfdiData.tipoComprobante,
                            serie: cfdiData.serie,
                            folio: cfdiData.folio,
                            fecha: cfdiData.fecha,
                            forma_pago: cfdiData.formaPago,
                            metodo_pago: cfdiData.metodoPago || 'PUE',
                            uso_cfdi: cfdiData.receptor.usoCfdi || 'G03',
                            moneda: cfdiData.moneda || 'MXN',
                            tipo_cambio: cfdiData.tipoCambio || 1,
                            subtotal: cfdiData.subtotal || cfdiData.total,
                            descuento: cfdiData.descuento || 0,
                            total: cfdiData.total,
                            saldo_insoluto: isPPD ? cfdiData.total : 0,
                            estado_pago: isPPD ? 'Pendiente' : 'Pagado',
                            uuid: cfdiData.uuid,
                            estado_sat: 'Timbrado'
                        }
                    });

                    try {
                        const xmlPath = getXmlPath(emisor.rfc, cfdiData.uuid);
                        fs.writeFileSync(xmlPath, xmlString, 'utf8');
                        doc.xml_url = getPublicUrl(emisor.rfc, 'xml', `${cfdiData.uuid}.xml`);
                        await doc.save();
                    } catch (wErr) {}

                    if (created) facturasImportadas++;
                    await recalcularSaldoFacturaEmitida(doc.id);
                } else if (cfdiData.tipoComprobante === 'P') {
                    const [docRep] = await Documento.findOrCreate({
                        where: { uuid: cfdiData.uuid },
                        defaults: {
                            emisor_id: emisor.id,
                            receptor_id: receptor.id,
                            usuario_id: req.usuario?.id || 1,
                            tipo_comprobante: 'P',
                            serie: cfdiData.serie,
                            folio: cfdiData.folio,
                            fecha: cfdiData.fecha,
                            forma_pago: '99',
                            metodo_pago: 'PUE',
                            moneda: 'XXX',
                            total: 0,
                            subtotal: 0,
                            estado_pago: 'Pagado',
                            estado_sat: 'Timbrado',
                            uuid: cfdiData.uuid
                        }
                    });

                    try {
                        const xmlPath = getXmlPath(emisor.rfc, cfdiData.uuid);
                        fs.writeFileSync(xmlPath, xmlString, 'utf8');
                        docRep.xml_url = getPublicUrl(emisor.rfc, 'xml', `${cfdiData.uuid}.xml`);
                        await docRep.save();
                    } catch (wErr) {}

                    if (cfdiData.pagos) {
                        for (const pItem of cfdiData.pagos) {
                            const [pago, createdP] = await Pago.findOrCreate({
                                where: { documento_rep_id: docRep.id, fecha_pago: pItem.fechaPago, monto: pItem.monto },
                                defaults: {
                                    emisor_id: emisor.id,
                                    receptor_id: receptor.id,
                                    fecha_pago: pItem.fechaPago,
                                    forma_pago: pItem.formaPagoP || '03',
                                    monto: pItem.monto,
                                    moneda: pItem.monedaP || 'MXN',
                                    tipo_cambio: pItem.tipoCambioP || 1,
                                    documento_rep_id: docRep.id
                                }
                            });

                            if (pItem.documentosRelacionados) {
                                for (const dr of pItem.documentosRelacionados) {
                                    const facRel = await Documento.findOne({ where: { uuid: dr.idDocumento } });
                                    if (facRel) {
                                        await PagoDocumento.findOrCreate({
                                            where: { pago_id: pago.id, documento_id: facRel.id },
                                            defaults: {
                                                pago_id: pago.id,
                                                documento_id: facRel.id,
                                                num_parcialidad: dr.numParcialidad || 1,
                                                imp_saldo_ant: (dr.impSaldoInsoluto || 0) + (dr.impPagado || 0),
                                                imp_pagado: dr.impPagado,
                                                imp_saldo_insoluto: dr.impSaldoInsoluto || 0,
                                                moneda_dr: dr.monedaDR || 'MXN',
                                                equivalencia_dr: 1
                                            }
                                        });
                                        await recalcularSaldoFacturaEmitida(facRel.id);
                                    }
                                }
                            }
                            if (createdP) pagosImportados++;
                        }
                    }
                }
            } catch (err) {
                console.error('Error al importar archivo XML emitido:', file.originalname, err.message);
                errores++;
            }
        }

        res.json({
            message: `Procesamiento completado: ${facturasImportadas} facturas y ${pagosImportados} pagos importados a Cartera.`,
            facturasImportadas,
            pagosImportados,
            errores
        });
    } catch (error) {
        console.error('Error en importarXmlsEmitidosManual:', error);
        res.status(500).json({ message: error.message || 'Error al procesar archivos XML' });
    }
};
