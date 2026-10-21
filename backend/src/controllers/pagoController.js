import { Pago, PagoDocumento, Documento, Receptor, Emisor, SerieFolio } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';
import { generarXMLPago, firmarXML, timbrarPAC } from '../services/cfdiService.js';
import { generarPDF, generarPDFPagoPreview } from '../services/pdfService.js';
import fs from 'fs';
import path from 'path';
import { STORAGE_BASE } from '../utils/storageHelper.js';

export const getPagos = async (req, res) => {
    const { emisor_id } = req.query;
    try {
        const pagos = await Pago.findAll({
            where: emisor_id ? { emisor_id } : {},
            include: [
                { model: Receptor, attributes: ['razon_social', 'rfc'] },
                { model: Documento, attributes: ['id', 'serie', 'folio', 'uuid'], through: { attributes: ['num_parcialidad', 'imp_pagado'] } },
                { model: Documento, as: 'DocumentoREP', attributes: ['id', 'uuid', 'pdf_url'] }
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

        for (const {f, doc} of validFacturas) {
            const saldoAnterior = parseFloat(doc.saldo_insoluto !== null ? doc.saldo_insoluto : doc.total);
            const montoAplicado = parseFloat(f.monto_aplicado);
            const nuevoSaldoInsoluto = saldoAnterior - montoAplicado;
            
            // Calcular equivalencia_dr: Tipo de cambio del pago si las monedas difieren
            let equivalenciaDR = 1;
            if (nuevoPago.moneda !== doc.moneda) {
                // Si el pago es USD y factura MXN, la equivalencia es el tipo de cambio (ej. 20)
                equivalenciaDR = nuevoPago.tipo_cambio || 1;
            }

            // Determinar número de parcialidad
            const lastRel = await PagoDocumento.findOne({
                where: { documento_id: doc.id },
                order: [['num_parcialidad', 'DESC']],
                transaction: t
            });
            const numParcialidad = lastRel ? lastRel.num_parcialidad + 1 : 1;

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
        
        const pdfBuffer = await generarPDFPagoPreview(emisor_id, receptor_id, {
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

        const filename = `preview-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.pdf`;
        const absolutePath = path.join(previewsDir, filename);
        await fs.promises.writeFile(absolutePath, pdfBuffer);

        const publicUrl = `/storage/previews/${filename}`;
        res.json({ success: true, pdfUrl: publicUrl });
    } catch (error) {
        console.error('Error generating PDF preview:', error);
        res.status(500).json({ message: error.message || 'Error al generar la vista previa del PDF' });
    }
};
