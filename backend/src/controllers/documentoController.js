import { Documento, DetalleDocumento, Emisor, Receptor, Concepto, Impuesto, SerieFolio, Pago, PagoDocumento } from '../models/index.js';
import { generarXML, firmarXML, timbrarPAC, cancelarCFDIPAC, consultarStatusSatPAC } from '../services/cfdiService.js';
import { generarPDF } from '../services/pdfService.js';
import { enviarFacturaPorCorreo } from '../services/emailService.js';
import { Op } from 'sequelize';

const checkResicoApplies = async (emisor, receptor, invoiceDate = new Date()) => {
    // La retención del 1.25% solo aplica de Persona Física (RFC 13 caracteres) RESICO (626) a Persona Moral (RFC 12 caracteres)
    if (emisor.rfc.length !== 13 || emisor.regimen_fiscal !== '626' || receptor.rfc.length !== 12) {
        return false;
    }

    if (emisor.es_agapes) {
        const currentYear = invoiceDate.getFullYear();
        const startDate = new Date(`${currentYear}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

        const totalFacturado = await Documento.sum('subtotal', {
            where: {
                emisor_id: emisor.id,
                estado_sat: 'Timbrado',
                fecha: {
                    [Op.between]: [startDate, endDate]
                }
            }
        }) || 0;

        if (totalFacturado <= 900000) {
            return false;
        }
    }

    return true;
};

export const emitirFactura = async (req, res) => {
    const {
        emisorId,
        receptorId,
        detalles,
        fecha,
        forma_pago,
        metodo_pago,
        moneda,
        subtotal,
        total,
        total_impuestos_trasladados,
        total_impuestos_retenidos,
        ajuste_manual,
        tipo_comprobante,
        tipo_documento_id,
        // --- Nuevos campos CFDI 4.0 ---
        es_global,
        periodicidad,
        meses,
        anio,
        tipo_relacion,
        uuids_relacionados,
        serie: serieUser,
        folio: folioUser,
        uso_cfdi,
        tipo_cambio,
        soloGuardar,
        impuestosLocales
    } = req.body;

    try {
        const emisor = await Emisor.findByPk(emisorId);
        const receptor = await Receptor.findByPk(receptorId);

        if (!emisor || !receptor) {
            return res.status(404).json({ message: 'Emisor o Receptor no encontrados.' });
        }

        // --- Gestión de Folios ---
        let serie = serieUser || 'A';
        let folio = folioUser;

        if (!folio) {
            // Buscar la serie del emisor
            let serieObj = await SerieFolio.findOne({ 
                where: { 
                    emisor_id: emisorId, 
                    serie: serie,
                    tipo_documento_id: tipo_documento_id || null
                } 
            });

            if (!serieObj) {
                // Crear serie default si no existe
                serieObj = await SerieFolio.create({ 
                    emisor_id: emisorId, 
                    serie, 
                    ultimo_folio: 0,
                    tipo_documento_id: tipo_documento_id || null
                });
            }

            folio = serieObj.ultimo_folio + 1;

            // Incrementar folio (idealmente en transacción, pero simplificamos aquí)
            await serieObj.update({ ultimo_folio: folio });
        }

        const invoiceDate = fecha ? new Date(fecha) : new Date();
        const resicoApplies = await checkResicoApplies(emisor, receptor, invoiceDate);

        const conceptIds = (detalles || []).map(d => d.concepto_id);
        const conceptosDb = await Concepto.findAll({
            where: { id: conceptIds },
            include: [Impuesto]
        });

        // Helper para redondear a 2 decimales comerciales (estándar CFDI 4.0 moneda MXN/USD)
        const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

        // Recalcular Subtotal, Descuento y Total de Impuestos
        let computedSubtotal = 0;
        let computedDescuento = 0;
        let totalIVA = 0;
        let totalRet = 0;

        const lineasMap = (detalles || []).map(det => {
            const qty = parseFloat(det.cantidad) || 0;
            const price = parseFloat(det.valor_unitario) || 0;
            const descExact = parseFloat(det.descuento) || 0;
            const exactBase = (qty * price) - descExact;
            const desc = round2(descExact);
            const importeConcepto = round2(qty * price);
            const baseAmount = round2(importeConcepto - desc);

            computedSubtotal = round2(computedSubtotal + importeConcepto);
            computedDescuento = round2(computedDescuento + desc);

            let itemRetIsr = det.retencion_isr || false;
            let itemRetIsrTasa = det.retencion_isr_tasa || 0.10;
            let itemRetIva = det.retencion_iva || false;

            if (resicoApplies && (det.es_objeto_imp || '02') === '02') {
                itemRetIsr = true;
                itemRetIsrTasa = 0.0125;
            }

            const conceptoObj = conceptosDb.find(c => c.id === det.concepto_id);
            let conceptTraslados = conceptoObj?.Impuestos?.filter(imp => imp.tipo === 'traslado') || [];
            if (conceptTraslados.length === 0) {
                // Default IVA 16%
                conceptTraslados = [{
                    impuesto_sat: '002',
                    tipo_factor: 'Tasa',
                    tasa_cuota: 0.16
                }];
            }

            if ((det.es_objeto_imp || '02') === '02') {
                conceptTraslados.forEach(imp => {
                    const tasa = parseFloat(imp.tasa_cuota);
                    const tipoFactor = imp.tipo_factor;
                    const impAmt = tipoFactor === 'Exento' ? 0 : round2(exactBase * tasa);
                    totalIVA = round2(totalIVA + impAmt);
                });

                if (itemRetIsr) {
                    totalRet = round2(totalRet + round2(exactBase * parseFloat(itemRetIsrTasa)));
                }
                if (itemRetIva) {
                    totalRet = round2(totalRet + round2(exactBase * 0.106667));
                }
            }

            return {
                concepto_id: det.concepto_id,
                cantidad: qty,
                valor_unitario: price,
                importe: baseAmount,
                descuento: desc,
                es_objeto_imp: det.es_objeto_imp || '02',
                cuenta_predial: det.cuenta_predial,
                retencion_isr: itemRetIsr,
                retencion_iva: itemRetIva,
                retencion_isr_tasa: itemRetIsrTasa
            };
        });

        // Sumar Impuestos Locales
        let totalTrasladosLocales = 0;
        let totalRetencionesLocales = 0;
        if (impuestosLocales) {
            try {
                const il = typeof impuestosLocales === 'string' ? JSON.parse(impuestosLocales) : impuestosLocales;
                if (il && il.traslados && Array.isArray(il.traslados)) {
                    il.traslados.forEach(t => {
                        totalTrasladosLocales = round2(totalTrasladosLocales + round2(t.importe || 0));
                    });
                }
                if (il && il.retenciones && Array.isArray(il.retenciones)) {
                    il.retenciones.forEach(r => {
                        totalRetencionesLocales = round2(totalRetencionesLocales + round2(r.importe || 0));
                    });
                }
            } catch (e) {
                console.error("Error parsing local taxes:", e);
            }
        }

        const finalSubtotal = round2(ajuste_manual ? subtotal : computedSubtotal);
        const finalTraslados = round2(ajuste_manual ? total_impuestos_trasladados : totalIVA);
        const finalRetenciones = round2(ajuste_manual ? total_impuestos_retenidos : totalRet);
        const finalTotal = round2(ajuste_manual ? total : (computedSubtotal - computedDescuento + totalIVA - totalRet + totalTrasladosLocales - totalRetencionesLocales));

        const nuevoDocumento = await Documento.create({
            emisor_id: emisorId,
            receptor_id: receptorId,
            usuario_id: req.usuario.id,
            tipo_documento_id: tipo_documento_id || 1,
            tipo_comprobante: tipo_comprobante || 'I',
            fecha: invoiceDate,
            forma_pago,
            metodo_pago,
            moneda: moneda || 'MXN',
            subtotal: finalSubtotal,
            total_impuestos_trasladados: finalTraslados,
            total_impuestos_retenidos: finalRetenciones,
            total: finalTotal,
            ajuste_manual: ajuste_manual || false,
            serie,
            folio,
            uso_cfdi,
            tipo_cambio: tipo_cambio || 1,
            es_global: es_global || false,
            periodicidad,
            meses,
            anio,
            tipo_relacion,
            uuids_relacionados,
            saldo_insoluto: metodo_pago === 'PPD' ? finalTotal : 0,
            estado_pago: metodo_pago === 'PUE' ? 'Pagado' : 'Pendiente',
            estado_sat: 'No Timbrado',
            impuestos_locales: impuestosLocales
        });

        if (lineasMap.length > 0) {
            const lineas = lineasMap.map(linea => ({
                ...linea,
                documento_id: nuevoDocumento.id
            }));
            await DetalleDocumento.bulkCreate(lineas);
        }

        if (soloGuardar) {
            return res.status(201).json({
                message: 'Documento guardado como borrador.',
                documento: nuevoDocumento
            });
        }

        const lineasDetalle = await DetalleDocumento.findAll({
            where: { documento_id: nuevoDocumento.id },
            include: [{ model: Concepto, include: [Impuesto] }]
        });

        const xmlTimbrado = await generarXML(nuevoDocumento, emisor, receptor, lineasDetalle);
        const xmlFirmado = await firmarXML(xmlTimbrado, emisor.id);
        const timbrado = await timbrarPAC(xmlFirmado, emisor);

        await nuevoDocumento.update({
            uuid: timbrado.uuid,
            estado_sat: 'Timbrado',
            xml_url: timbrado.xmlTimbradoUrl,
            // Nuevos campos técnicos
            no_certificado_emisor: timbrado.noCertificadoEmisor,
            no_certificado_sat: timbrado.noCertificadoSAT,
            fecha_timbrado: timbrado.fechaTimbrado,
            sello_cfdi: timbrado.selloCFDI,
            sello_sat: timbrado.selloSAT,
            cadena_original_tfd: timbrado.cadenaOriginalTFD
        });

        // Generar PDF DESPUÉS de actualizar metadatos para que el servicio de PDF los lea de la DB
        const pdfResult = await generarPDF(nuevoDocumento, emisor, receptor, lineasDetalle);

        await nuevoDocumento.update({ pdf_url: pdfResult.pdfUrl });

        // Si es Nota de Crédito (E) o Devolución (01 / 03), descontar saldo insoluto del documento origen
        if ((nuevoDocumento.tipo_comprobante === 'E' || ['01', '03'].includes(nuevoDocumento.tipo_relacion)) && nuevoDocumento.uuids_relacionados) {
            try {
                const uuids = String(nuevoDocumento.uuids_relacionados)
                    .split(/[\n,;]+/)
                    .map(u => u.trim())
                    .filter(Boolean);
                let montoRestanteNota = Math.round((parseFloat(nuevoDocumento.total) || 0) * 100) / 100;
                for (const u of uuids) {
                    if (montoRestanteNota <= 0) break;
                    const docOrigen = await Documento.findOne({
                        where: { uuid: u, tipo_comprobante: 'I', emisor_id: emisor.id }
                    });
                    if (docOrigen) {
                        const saldoActual = Math.round((parseFloat(docOrigen.saldo_insoluto !== null ? docOrigen.saldo_insoluto : docOrigen.total) || 0) * 100) / 100;
                        const descuentoAplicar = Math.min(saldoActual, montoRestanteNota);
                        let nuevoSaldo = Math.round((saldoActual - descuentoAplicar) * 100) / 100;
                        if (nuevoSaldo <= 0.009) nuevoSaldo = 0;
                        await docOrigen.update({
                            saldo_insoluto: nuevoSaldo,
                            estado_pago: nuevoSaldo <= 0 ? 'Pagado' : 'Pago Parcial'
                        });
                        montoRestanteNota = Math.round((montoRestanteNota - descuentoAplicar) * 100) / 100;
                    }
                }
            } catch (ncErr) {
                console.error('Error aplicando Nota de Crédito al saldo del documento origen:', ncErr);
            }
        }

        // Envío Automático de Correo (si está habilitado)
        let correoResultado = null;
        const quiereEnviarCorreo = req.body.enviar_correo !== false && req.body.enviar_correo !== 'false';
        const destinatarioFinal = (req.body.correo_destinatario || req.body.destinatarios || receptor?.correo || '').trim();

        if (quiereEnviarCorreo && destinatarioFinal) {
            try {
                correoResultado = await enviarFacturaPorCorreo(
                    nuevoDocumento,
                    receptor,
                    timbrado.xmlTimbradoUrl,
                    pdfResult.pdfUrl,
                    { destinatarios: destinatarioFinal }
                );
            } catch (err) {
                console.error("Error al enviar correo automático tras timbrar:", err);
                correoResultado = { success: false, message: err.message };
            }
        }

        res.status(201).json({
            message: 'Factura generada y timbrada exitosamente.',
            documento: nuevoDocumento,
            correo: correoResultado
        });

    } catch (error) {
        console.error('Error emitiendo factura:', error);
        
        if (error.name === 'SequelizeValidationError') {
            const messages = error.errors.map(err => `${err.path}: ${err.message}`);
            return res.status(400).json({ 
                message: 'Error de validación en los datos', 
                details: messages 
            });
        }

        res.status(500).json({ 
            message: error.message || 'Error inesperado',
            details: Array.isArray(error.errors) ? error.errors.map(err => err.message) : (error.message || undefined)
        });
    }
};

/**
 * Procesa el timbrado de un documento ya existente (que esté como "No Timbrado")
 */
export const timbrarDocumento = async (req, res) => {
    const { id } = req.params;

    try {
        const documento = await Documento.findByPk(id, {
            include: [
                { model: Emisor },
                { model: Receptor }
            ]
        });

        if (!documento) {
            return res.status(404).json({ message: 'Documento no encontrado.' });
        }

        if (documento.estado_sat === 'Timbrado') {
            return res.status(400).json({ message: 'El documento ya se encuentra timbrado.' });
        }

        const emisor = documento.Emisor;
        const receptor = documento.Receptor;

        const lineasDetalle = await DetalleDocumento.findAll({
            where: { documento_id: documento.id },
            include: [{
                model: Concepto,
                include: [Impuesto]
            }]
        });

        console.log(`[Controller] Iniciando proceso de timbrado diferido para ID: ${id}`);

        const xmlString = await generarXML(documento, emisor, receptor, lineasDetalle);
        const xmlFirmado = await firmarXML(xmlString, emisor.id);
        const timbrado = await timbrarPAC(xmlFirmado, emisor);

        // Actualizar Documento con metadatos de timbrado
        await documento.update({
            uuid: timbrado.uuid,
            estado_sat: 'Timbrado',
            xml_url: timbrado.xmlTimbradoUrl,
            no_certificado_emisor: timbrado.noCertificadoEmisor,
            no_certificado_sat: timbrado.noCertificadoSAT,
            fecha_timbrado: timbrado.fechaTimbrado,
            sello_cfdi: timbrado.selloCFDI,
            sello_sat: timbrado.selloSAT,
            cadena_original_tfd: timbrado.cadenaOriginalTFD
        });

        // Generar versión impresa DESPUÉS del timbrado
        const pdfResult = await generarPDF(documento, emisor, receptor, lineasDetalle);

        await documento.update({ pdf_url: pdfResult.pdfUrl });

        // Enviar Correo (si está habilitado)
        let correoResultado = null;
        const quiereEnviarCorreo = req.body.enviar_correo !== false && req.body.enviar_correo !== 'false';
        const destinatarioFinal = (req.body.correo_destinatario || req.body.destinatarios || receptor?.correo || '').trim();

        if (quiereEnviarCorreo && destinatarioFinal) {
            try {
                correoResultado = await enviarFacturaPorCorreo(
                    documento,
                    receptor,
                    timbrado.xmlTimbradoUrl,
                    pdfResult.pdfUrl,
                    { destinatarios: destinatarioFinal }
                );
            } catch (err) {
                console.error("Error enviando correo en timbrado diferido:", err);
                correoResultado = { success: false, message: err.message };
            }
        }

        res.json({
            message: 'Documento timbrado exitosamente.',
            documento,
            correo: correoResultado
        });

    } catch (error) {
        console.error('Error en timbrado diferido:', error);
        
        if (error.name === 'SequelizeValidationError') {
            const messages = error.errors.map(err => `${err.path}: ${err.message}`);
            return res.status(400).json({ 
                message: 'Error de validación al actualizar documento', 
                details: messages 
            });
        }

        res.status(500).json({
            message: error.message || 'Error al procesar el timbrado',
            details: Array.isArray(error.errors) ? error.errors.map(err => err.message) : (error.message || undefined)
        });
    }
};

export const getDocumentos = async (req, res) => {
    const { emisorId, tipoComprobante, receptorId } = req.query; // Filtro
    try {
        let whereClause = {};
        if (tipoComprobante && tipoComprobante !== 'TODOS') {
            if (tipoComprobante.includes(',')) {
                whereClause.tipo_comprobante = { [Op.in]: tipoComprobante.split(',').map(t => t.trim()) };
            } else {
                whereClause.tipo_comprobante = tipoComprobante;
            }
        } else if (!tipoComprobante) {
            whereClause.tipo_comprobante = 'I';
        }
        if (emisorId) whereClause.emisor_id = emisorId;
        if (receptorId) whereClause.receptor_id = receptorId;

        const documentos = await Documento.findAll({
            where: whereClause,
            include: [
                { model: Receptor, attributes: ['id', 'razon_social', 'rfc', 'uso_cfdi', 'correo'] },
                {
                    model: DetalleDocumento,
                    as: 'detalles',
                    include: [{ model: Concepto, include: [Impuesto] }]
                },
                {
                    model: Pago,
                    through: { attributes: ['num_parcialidad', 'imp_saldo_ant', 'imp_pagado', 'imp_saldo_insoluto'] },
                    include: [
                        { model: Documento, as: 'DocumentoREP', attributes: ['id', 'serie', 'folio', 'uuid', 'fecha', 'estado_sat', 'motivo_cancelacion', 'fecha_cancelacion', 'pdf_url', 'xml_url'] }
                    ]
                }
            ],
            order: [['fecha', 'DESC']]
        });

        // Buscar Notas de Crédito / Devoluciones / CFDI que relacionan a estos documentos de ingreso
        const docsRelacionadosEmisor = await Documento.findAll({
            where: emisorId ? { emisor_id: emisorId } : {},
            attributes: ['id', 'serie', 'folio', 'uuid', 'fecha', 'tipo_comprobante', 'tipo_documento_id', 'tipo_relacion', 'uuids_relacionados', 'subtotal', 'total', 'moneda', 'estado_sat', 'motivo_cancelacion', 'fecha_cancelacion', 'acuse_cancelacion', 'pdf_url', 'xml_url'],
            order: [['fecha', 'ASC']]
        });

        const docsConRelaciones = documentos.map(doc => {
            const plain = doc.toJSON();
            const docUuid = (plain.uuid || '').toLowerCase().trim();
            if (docUuid) {
                plain.NotasRelacionadas = docsRelacionadosEmisor
                    .filter(rel => {
                        if (rel.id === plain.id || !rel.uuids_relacionados) return false;
                        const list = String(rel.uuids_relacionados)
                            .split(/[\n,;]+/)
                            .map(u => u.trim().toLowerCase())
                            .filter(Boolean);
                        return list.includes(docUuid);
                    })
                    .map(rel => rel.toJSON());
            } else {
                plain.NotasRelacionadas = [];
            }
            return plain;
        });

        res.json(docsConRelaciones);
    } catch (error) {
        console.error('Error fetching documentos:', error);
        res.status(500).json({ message: 'Error al obtener documentos' });
    }
};

/**
 * Genera una vista previa del PDF sin guardar en base de datos.
 */
export const previewDocumento = async (req, res) => {
    const { emisorId, receptorId, detalles, impuestosLocales, ...facturaData } = req.body;
    try {
        const emisor = await Emisor.findByPk(emisorId);
        const receptor = await Receptor.findByPk(receptorId);

        if (!emisor) return res.status(404).json({ message: 'Emisor no encontrado' });

        // Mock de receptor si no existe id aún (ej. nuevo receptor en modal)
        const receptorFinal = receptor || {
            razon_social: 'RECEPTOR DE PRUEBA',
            rfc: 'XAXX010101000',
            regimen_fiscal: '601',
            codigo_postal: '00000'
        };

        // Obtener el siguiente folio disponible para la serie seleccionada
        const serieObj = await SerieFolio.findOne({
            where: { emisor_id: emisorId, serie: facturaData.serie }
        });
        const proximoFolio = serieObj ? serieObj.ultimo_folio + 1 : 1;
        console.log(`[Preview] Serie: ${facturaData.serie}, Ultimo: ${serieObj?.ultimo_folio}, Proximo: ${proximoFolio}`);

        const invoiceDate = facturaData.fecha ? new Date(facturaData.fecha) : new Date();
        const resicoApplies = await checkResicoApplies(emisor, receptorFinal, invoiceDate);

        // Formatear detalles para el servicio
        const lineas = await Promise.all(detalles.map(async (d) => {
            const concepto = await Concepto.findByPk(d.concepto_id, { include: [Impuesto] });
            
            let itemRetIsr = d.retencion_isr || false;
            let itemRetIsrTasa = d.retencion_isr_tasa || 0.10;
            let itemRetIva = d.retencion_iva || false;

            if (resicoApplies && (d.es_objeto_imp || '02') === '02') {
                itemRetIsr = true;
                itemRetIsrTasa = 0.0125;
            }

            return {
                ...d,
                retencion_isr: itemRetIsr,
                retencion_isr_tasa: itemRetIsrTasa,
                retencion_iva: itemRetIva,
                descripcion: d.descripcion || (concepto ? concepto.descripcion : ''),
                unidad: d.unidad || (concepto ? concepto.unidad : ''),
                clave_unidad: d.clave_unidad || (concepto ? concepto.clave_unidad : ''),
                clave_sat: d.clave_sat || (concepto ? concepto.clave_prod_serv : ''),
                Concepto: concepto ? concepto.toJSON() : null
            };
        }));

        // Recalcular Subtotal y Total para el PDF de vista previa
        let computedSubtotal = 0;
        let computedDescuento = 0;
        let totalIVA = 0;
        let totalRet = 0;

        lineas.forEach(det => {
            const qty = parseFloat(det.cantidad) || 0;
            const price = parseFloat(det.valor_unitario) || 0;
            const desc = parseFloat(det.descuento) || 0;
            const baseAmount = (qty * price) - desc;

            computedSubtotal += (qty * price);
            computedDescuento += desc;

            let conceptTraslados = det.Concepto?.Impuestos || [];
            conceptTraslados = conceptTraslados.filter(imp => imp.tipo === 'traslado');
            if (conceptTraslados.length === 0) {
                // Default IVA 16%
                conceptTraslados = [{
                    impuesto_sat: '002',
                    tipo_factor: 'Tasa',
                    tasa_cuota: 0.16
                }];
            }

            if ((det.es_objeto_imp || '02') === '02') {
                conceptTraslados.forEach(imp => {
                    const tasa = parseFloat(imp.tasa_cuota);
                    const tipoFactor = imp.tipo_factor;
                    const impAmt = tipoFactor === 'Exento' ? 0 : Math.round(baseAmount * tasa * 100) / 100;
                    totalIVA += impAmt;
                });

                if (det.retencion_isr) {
                    totalRet += Math.round(baseAmount * parseFloat(det.retencion_isr_tasa) * 100) / 100;
                }
                if (det.retencion_iva) {
                    totalRet += Math.round(baseAmount * 0.106667 * 100) / 100;
                }
            }
        });

        let totalTrasladosLocales = 0;
        let totalRetencionesLocales = 0;
        if (impuestosLocales) {
            try {
                const il = typeof impuestosLocales === 'string' ? JSON.parse(impuestosLocales) : impuestosLocales;
                if (il && il.traslados && Array.isArray(il.traslados)) {
                    il.traslados.forEach(t => {
                        totalTrasladosLocales += parseFloat(t.importe || 0);
                    });
                }
                if (il && il.retenciones && Array.isArray(il.retenciones)) {
                    il.retenciones.forEach(r => {
                        totalRetencionesLocales += parseFloat(r.importe || 0);
                    });
                }
            } catch (e) {
                console.error("Error parsing local taxes in preview:", e);
            }
        }

        const computedTotal = computedSubtotal - computedDescuento + totalIVA - totalRet + totalTrasladosLocales - totalRetencionesLocales;
        const finalSubtotal = facturaData.ajuste_manual ? parseFloat(facturaData.subtotal) : computedSubtotal;
        const finalTraslados = facturaData.ajuste_manual ? parseFloat(facturaData.total_impuestos_trasladados) : totalIVA;
        const finalRetenciones = facturaData.ajuste_manual ? parseFloat(facturaData.total_impuestos_retenidos) : totalRet;
        const finalTotal = facturaData.ajuste_manual ? parseFloat(facturaData.total) : computedTotal;

        const dummyDoc = {
            id: 'preview_' + Date.now(),
            ...facturaData,
            subtotal: finalSubtotal,
            total_impuestos_trasladados: finalTraslados,
            total_impuestos_retenidos: finalRetenciones,
            total: finalTotal,
            ajuste_manual: facturaData.ajuste_manual || false,
            folio: proximoFolio,
            fecha: invoiceDate,
            estado_sat: 'No Timbrado',
            impuestos_locales: impuestosLocales
        };

        const fs = await import('fs');
        fs.appendFileSync('preview_debug.log', `[${new Date().toISOString()}] Detalles sample: ${JSON.stringify(lineas[0], null, 2)}\n`);
        const pdfRes = await generarPDF(dummyDoc, emisor, receptorFinal, lineas);

        // Añadir timestamp para evitar caché
        if (pdfRes.success) {
            pdfRes.pdfUrl += `?t=${Date.now()}`;
        }

        res.json(pdfRes);
    } catch (error) {
        console.error('Error en preview:', error);
        res.status(500).json({ message: 'Error al generar vista previa', error: error.message });
    }
};

/**
 * Re-genera el PDF de un documento existente con el diseño actual del emisor.
 */
export const reproducirPDF = async (req, res) => {
    const { id } = req.params;
    try {
        const documento = await Documento.findByPk(id, {
            include: [Emisor, Receptor]
        });

        if (!documento) return res.status(404).json({ message: 'Documento no encontrado' });

        const lineas = await DetalleDocumento.findAll({
            where: { documento_id: id },
            include: [{ model: Concepto, include: [Impuesto] }]
        });

        const pdfRes = await generarPDF(documento, documento.Emisor, documento.Receptor, lineas);

        // Actualizar la URL en la DB por si acaso cambió
        if (pdfRes.success) {
            await documento.update({ pdf_url: pdfRes.pdfUrl });
            pdfRes.pdfUrl += `?t=${Date.now()}`;
        }

        res.json(pdfRes);
    } catch (error) {
        console.error('Error re-generando PDF:', error);
        res.status(500).json({ message: 'Error al re-generar PDF', error: error.message });
    }
};

/**
 * Envía o reenvía un documento CFDI (PDF + XML) por correo electrónico.
 */
export const enviarDocumentoPorCorreo = async (req, res) => {
    const { id } = req.params;
    const { destinatarios, email, correo, asunto, mensaje } = req.body;
    const targetEmails = destinatarios || email || correo || '';
    try {
        const documento = await Documento.findByPk(id, {
            include: [Emisor, Receptor]
        });

        if (!documento) return res.status(404).json({ message: 'Documento no encontrado' });

        // Si el documento no tiene pdf_url generado aún, generarlo primero
        let pdfUrl = documento.pdf_url;
        if (!pdfUrl && documento.tipo_comprobante !== 'P') {
            const lineas = await DetalleDocumento.findAll({
                where: { documento_id: id },
                include: [{ model: Concepto, include: [Impuesto] }]
            });
            const pdfRes = await generarPDF(documento, documento.Emisor, documento.Receptor, lineas);
            if (pdfRes?.success) {
                pdfUrl = pdfRes.pdfUrl;
                await documento.update({ pdf_url: pdfUrl });
            }
        }

        const result = await enviarFacturaPorCorreo(
            documento,
            documento.Receptor,
            documento.xml_url,
            pdfUrl,
            {
                emisor: documento.Emisor,
                destinatarios: targetEmails,
                asunto,
                mensaje
            }
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        // Si el Receptor aún no tenía correo guardado en catálogo, guardarlo automáticamente para futuros envíos
        if (documento.Receptor && !documento.Receptor.correo && targetEmails) {
            const firstEmail = String(targetEmails).split(/[,;\s]+/).map(e => e.trim()).find(e => e.includes('@'));
            if (firstEmail) {
                await documento.Receptor.update({ correo: firstEmail }).catch(() => {});
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error enviando documento por correo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al enviar el comprobante por correo.'
        });
    }
};

/**
 * Descarga directa del archivo XML de un documento.
 */
export const descargarXML = async (req, res) => {
    const { id } = req.params;
    try {
        const documento = await Documento.findByPk(id, { include: [Emisor] });
        if (!documento || !documento.uuid) {
            return res.status(404).json({ message: 'Archivo XML no encontrado o documento sin timbrar.' });
        }
        const { getXmlPath } = await import('../utils/storageHelper.js');
        const fs = await import('fs');
        const xmlPath = getXmlPath(documento.Emisor?.rfc || '', documento.uuid);
        if (!fs.existsSync(xmlPath)) {
            return res.status(404).json({ message: 'El archivo XML no existe físicamente en el servidor.' });
        }
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="${documento.uuid}.xml"`);
        res.sendFile(xmlPath);
    } catch (error) {
        console.error('Error descargando XML:', error);
        res.status(500).json({ message: 'Error al descargar el archivo XML.' });
    }
};

/**
 * Diagnóstico Pre-Cancelación SAT CFDI 4.0:
 * Evalúa todas las aristas fiscales antes de cancelar un documento (Ingreso, Egreso/Nota de Crédito, Pago/REP, Traslado):
 *  1) Documentos hijos activos que bloquean la cancelación (REPs vigentes, Notas de Crédito vigentes).
 *  2) Candidatos válidos para Sustitución (Motivo 01).
 *  3) Efectos contables de reversión de saldos (al cancelar un REP o una Nota de Crédito).
 *  4) Reglas SAT sobre aceptación del receptor (> $1,000 MXN y > 24 hrs).
 */
export const verificarPreCancelacion = async (req, res) => {
    const { id } = req.params;
    try {
        const documento = await Documento.findByPk(id, {
            include: [
                Emisor,
                Receptor,
                {
                    model: Pago,
                    through: { attributes: ['num_parcialidad', 'imp_saldo_ant', 'imp_pagado', 'imp_saldo_insoluto'] },
                    include: [
                        { model: Documento, as: 'DocumentoREP', attributes: ['id', 'serie', 'folio', 'uuid', 'fecha', 'estado_sat', 'pdf_url', 'xml_url'] }
                    ]
                }
            ]
        });

        if (!documento) {
            return res.status(404).json({ message: 'Documento no encontrado.' });
        }

        const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
        const docUuid = (documento.uuid || '').toLowerCase().trim();
        const bloqueos = [];
        const advertenciasSat = [];
        const efectosContables = [];
        let pagosActivos = [];
        let notasActivas = [];
        let sustitucionesDetectadas = [];

        // 1. Si es Factura de Ingreso ('I'), revisar si tiene Pagos/REPs activos o Notas de Crédito activas que bloqueen su cancelación en el SAT
        if (documento.tipo_comprobante === 'I') {
            pagosActivos = (documento.Pagos || []).filter(p => {
                const pagoCancelado = p.estado === 'Cancelado';
                const repCancelado = p.DocumentoREP && p.DocumentoREP.estado_sat === 'Cancelado';
                return !pagoCancelado && !repCancelado;
            });

            if (pagosActivos.length > 0) {
                bloqueos.push({
                    tipo: 'PAGOS_ACTIVOS',
                    titulo: 'Complementos de Pago (REP) / Abonos Vigentes',
                    mensaje: `Esta factura tiene ${pagosActivos.length} pago(s) o Complemento(s) de Recepción de Pagos (REP) activos. Por regla del SAT ("No Cancelable con documentos relacionados"), debes cancelar primero los Complementos de Pago antes de cancelar la factura de ingreso.`,
                    documentos: pagosActivos.map(p => ({
                        pago_id: p.id,
                        documento_rep_id: p.documento_rep_id || p.DocumentoREP?.id || null,
                        folio: p.DocumentoREP ? `${p.DocumentoREP.serie || 'P'}-${p.DocumentoREP.folio || p.id}` : `Pago #${p.id}`,
                        uuid: p.DocumentoREP?.uuid || null,
                        monto: round2(p.PagoDocumento?.imp_pagado || p.monto),
                        fecha: p.fecha_pago,
                        timbrado: Boolean(p.DocumentoREP?.uuid)
                    }))
                });
            }

            if (docUuid) {
                const todosHijos = await Documento.findAll({
                    where: {
                        emisor_id: documento.emisor_id,
                        id: { [Op.ne]: documento.id },
                        estado_sat: { [Op.ne]: 'Cancelado' },
                        uuids_relacionados: { [Op.not]: null }
                    },
                    attributes: ['id', 'serie', 'folio', 'uuid', 'fecha', 'tipo_comprobante', 'tipo_relacion', 'uuids_relacionados', 'total', 'moneda', 'estado_sat']
                });

                const hijosDeEsteDoc = todosHijos.filter(rel => {
                    const list = String(rel.uuids_relacionados || '')
                        .split(/[\n,;]+/)
                        .map(u => u.trim().toLowerCase())
                        .filter(Boolean);
                    return list.includes(docUuid);
                });

                notasActivas = hijosDeEsteDoc.filter(rel => rel.tipo_comprobante === 'E');
                sustitucionesDetectadas = hijosDeEsteDoc.filter(rel => rel.tipo_relacion === '04');

                if (notasActivas.length > 0) {
                    bloqueos.push({
                        tipo: 'NOTAS_CREDITO_ACTIVAS',
                        titulo: 'Notas de Crédito / Devoluciones Vigentes Aplicadas',
                        mensaje: `Esta factura tiene ${notasActivas.length} Nota(s) de Crédito o Devolución vigente(s) relacionada(s). El SAT no permite cancelar una factura mientras tenga un CFDI de Egreso vigente; primero debes cancelar la Nota de Crédito.`,
                        documentos: notasActivas.map(nc => ({
                            id: nc.id,
                            folio: `${nc.serie || 'NC'}-${nc.folio || nc.id}`,
                            uuid: nc.uuid,
                            tipo_relacion: nc.tipo_relacion || '01',
                            total: round2(nc.total),
                            moneda: nc.moneda || 'MXN',
                            fecha: nc.fecha
                        }))
                    });
                }
            }

            // Advertencia SAT de aceptación del receptor (Art. 29-A CFF / RMF)
            const totalMxn = round2(documento.total) * (parseFloat(documento.tipo_cambio) || 1);
            const horasDesdeTimbrado = documento.fecha_timbrado
                ? (Date.now() - new Date(documento.fecha_timbrado).getTime()) / (1000 * 60 * 60)
                : 0;

            if (documento.estado_sat === 'Timbrado' && !documento.es_global && totalMxn > 1000 && horasDesdeTimbrado > 24) {
                advertenciasSat.push({
                    tipo: 'BUZON_TRIBUTARIO',
                    mensaje: 'Por superar $1,000.00 MXN y haber transcurrido más de 24 horas desde su timbrado, en entorno productivo del SAT esta cancelación puede requerir aceptación del receptor en su Buzón Tributario (plazo de 72 horas hábiles).'
                });
            } else if (documento.estado_sat === 'Timbrado') {
                advertenciasSat.push({
                    tipo: 'CANCELACION_DIRECTA',
                    mensaje: 'Cumple con los supuestos de cancelación directa ante el SAT (sin requerir aceptación en Buzón Tributario).'
                });
            }
        }

        // 2. Si es Nota de Crédito / Devolución ('E'), calcular qué facturas de Ingreso recuperarán su saldo insoluto
        if (documento.tipo_comprobante === 'E' && documento.uuids_relacionados) {
            const targetUuids = String(documento.uuids_relacionados)
                .split(/[\n,;]+/)
                .map(u => u.trim())
                .filter(Boolean);

            if (targetUuids.length > 0) {
                const facturasOrigen = await Documento.findAll({
                    where: {
                        emisor_id: documento.emisor_id,
                        tipo_comprobante: 'I',
                        uuid: { [Op.in]: targetUuids }
                    }
                });

                for (const fac of facturasOrigen) {
                    const saldoActual = round2(fac.saldo_insoluto !== null ? fac.saldo_insoluto : fac.total);
                    const saldoRestaurado = Math.min(round2(fac.total), round2(saldoActual + round2(documento.total)));
                    efectosContables.push({
                        documento_id: fac.id,
                        folio: `${fac.serie || 'A'}-${fac.folio || fac.id}`,
                        uuid: fac.uuid,
                        saldo_actual: saldoActual,
                        monto_reversado: round2(documento.total),
                        saldo_nuevo: saldoRestaurado,
                        descripcion: `Al cancelar esta Nota de Crédito, la Factura ${fac.serie || 'A'}-${fac.folio || fac.id} recuperará +$${round2(documento.total).toFixed(2)} ${fac.moneda} en su saldo insoluto (pasando de $${saldoActual.toFixed(2)} a $${saldoRestaurado.toFixed(2)}) y quedará libre de esta relación.`
                    });
                }
            }
        }

        // 3. Si es Complemento de Pago ('P'), calcular qué facturas de Ingreso recuperarán su saldo insoluto
        if (documento.tipo_comprobante === 'P') {
            const pagoPadre = await Pago.findOne({
                where: { documento_rep_id: documento.id },
                include: [{
                    model: Documento,
                    through: { attributes: ['num_parcialidad', 'imp_saldo_ant', 'imp_pagado', 'imp_saldo_insoluto'] }
                }]
            });

            if (pagoPadre && pagoPadre.Documentos) {
                for (const fac of pagoPadre.Documentos) {
                    const pd = fac.PagoDocumento;
                    const montoPagado = round2(pd?.imp_pagado || pagoPadre.monto);
                    const saldoActual = round2(fac.saldo_insoluto !== null ? fac.saldo_insoluto : 0);
                    const saldoRestaurado = Math.min(round2(fac.total), round2(saldoActual + montoPagado));
                    efectosContables.push({
                        documento_id: fac.id,
                        folio: `${fac.serie || 'A'}-${fac.folio || fac.id}`,
                        uuid: fac.uuid,
                        saldo_actual: saldoActual,
                        monto_reversado: montoPagado,
                        saldo_nuevo: saldoRestaurado,
                        descripcion: `Al cancelar este Complemento de Pago (REP), la Factura ${fac.serie || 'A'}-${fac.folio || fac.id} recuperará +$${montoPagado.toFixed(2)} ${fac.moneda} en su saldo insoluto (pasando de $${saldoActual.toFixed(2)} a $${saldoRestaurado.toFixed(2)}).`
                    });
                }
            }
        }

        // 4. Buscar candidatos de sustitución para el Motivo "01 - Comprobante emitido con errores con relación"
        const candidatosRaw = await Documento.findAll({
            where: {
                emisor_id: documento.emisor_id,
                tipo_comprobante: documento.tipo_comprobante,
                estado_sat: 'Timbrado',
                uuid: { [Op.not]: null },
                id: { [Op.ne]: documento.id }
            },
            include: [{ model: Receptor, attributes: ['id', 'rfc', 'razon_social'] }],
            order: [['fecha', 'DESC']],
            limit: 30
        });

        const candidatosSustitucion = candidatosRaw.map(c => {
            const rels = String(c.uuids_relacionados || '').toLowerCase();
            const apuntaAEsteDoc = docUuid && rels.includes(docUuid);
            return {
                id: c.id,
                serie: c.serie,
                folio: c.folio,
                uuid: c.uuid,
                fecha: c.fecha,
                total: round2(c.total),
                moneda: c.moneda,
                receptor_rfc: c.Receptor?.rfc,
                receptor_nombre: c.Receptor?.razon_social,
                mismo_receptor: c.receptor_id === documento.receptor_id,
                apunta_como_sustituto: apuntaAEsteDoc
            };
        }).sort((a, b) => {
            if (a.apunta_como_sustituto !== b.apunta_como_sustituto) return a.apunta_como_sustituto ? -1 : 1;
            if (a.mismo_receptor !== b.mismo_receptor) return a.mismo_receptor ? -1 : 1;
            return 0;
        });

        const uuidSustitucionSugerido = sustitucionesDetectadas[0]?.uuid || candidatosSustitucion.find(c => c.apunta_como_sustituto)?.uuid || '';

        res.json({
            documento: {
                id: documento.id,
                serie: documento.serie,
                folio: documento.folio,
                uuid: documento.uuid,
                tipo_comprobante: documento.tipo_comprobante,
                total: round2(documento.total),
                moneda: documento.moneda || 'MXN',
                metodo_pago: documento.metodo_pago,
                estado_sat: documento.estado_sat,
                estado_pago: documento.estado_pago,
                es_global: Boolean(documento.es_global),
                fecha: documento.fecha,
                fecha_timbrado: documento.fecha_timbrado,
                receptor: documento.Receptor ? {
                    rfc: documento.Receptor.rfc,
                    razon_social: documento.Receptor.razon_social
                } : null
            },
            puedeCancelar: documento.estado_sat !== 'Cancelado' && bloqueos.length === 0,
            bloqueos,
            advertenciasSat,
            efectosContables,
            candidatosSustitucion,
            uuidSustitucionSugerido,
            motivoSugerido: uuidSustitucionSugerido ? '01' : (documento.es_global ? '04' : '02')
        });
    } catch (error) {
        console.error('Error en verificarPreCancelacion:', error);
        res.status(500).json({ message: 'Error al analizar las reglas de cancelación del documento.', error: error.message });
    }
};

/**
 * Ejecuta la cancelación de un CFDI (Ingreso, Egreso/Nota de Crédito, Pago/REP o Traslado)
 * validando todas las reglas SAT CFDI 4.0 y revirtiendo saldos contables automáticamente.
 */
export const cancelarDocumento = async (req, res) => {
    const { id } = req.params;
    const { motivoCancelacion = '02', uuidSustitucion = '' } = req.body;
    const round2 = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

    try {
        const documento = await Documento.findByPk(id, {
            include: [
                Emisor,
                Receptor,
                {
                    model: Pago,
                    through: { attributes: ['num_parcialidad', 'imp_saldo_ant', 'imp_pagado', 'imp_saldo_insoluto'] },
                    include: [
                        { model: Documento, as: 'DocumentoREP', attributes: ['id', 'serie', 'folio', 'uuid', 'estado_sat'] }
                    ]
                }
            ]
        });

        if (!documento) {
            return res.status(404).json({ message: 'Documento no encontrado.' });
        }

        if (documento.estado_sat === 'Cancelado') {
            return res.status(400).json({ message: 'Este documento ya se encuentra cancelado.' });
        }

        const motivosValidos = ['01', '02', '03', '04'];
        if (!motivosValidos.includes(motivoCancelacion)) {
            return res.status(400).json({ message: 'Clave de motivo de cancelación SAT inválida. Debe ser 01, 02, 03 o 04.' });
        }

        const uuidSustClean = (uuidSustitucion || '').trim();
        if (motivoCancelacion === '01') {
            if (!uuidSustClean || uuidSustClean.length < 30) {
                return res.status(400).json({
                    message: 'Para el motivo "01 - Comprobante emitido con errores con relación", el SAT exige indicar el UUID del comprobante que lo sustituye.'
                });
            }
            if (documento.uuid && uuidSustClean.toLowerCase() === documento.uuid.toLowerCase()) {
                return res.status(400).json({
                    message: 'El UUID de sustitución no puede ser el mismo UUID del documento que estás cancelando.'
                });
            }
        }

        // Validación de aristas SAT para documentos de Ingreso ('I'): no tener REPs ni Notas de Crédito vigentes
        const docUuid = (documento.uuid || '').toLowerCase().trim();
        if (documento.tipo_comprobante === 'I') {
            const pagosActivos = (documento.Pagos || []).filter(p => {
                const pagoCancelado = p.estado === 'Cancelado';
                const repCancelado = p.DocumentoREP && p.DocumentoREP.estado_sat === 'Cancelado';
                return !pagoCancelado && !repCancelado;
            });

            if (pagosActivos.length > 0) {
                return res.status(400).json({
                    message: `No se puede cancelar la factura porque tiene ${pagosActivos.length} Complemento(s) de Pago (REP) o abono(s) vigente(s). Por disposición del SAT, cancela primero el Complemento de Pago.`
                });
            }

            if (docUuid) {
                const todosHijos = await Documento.findAll({
                    where: {
                        emisor_id: documento.emisor_id,
                        tipo_comprobante: 'E',
                        id: { [Op.ne]: documento.id },
                        estado_sat: { [Op.ne]: 'Cancelado' },
                        uuids_relacionados: { [Op.not]: null }
                    }
                });

                const notasActivas = todosHijos.filter(rel => {
                    const list = String(rel.uuids_relacionados || '')
                        .split(/[\n,;]+/)
                        .map(u => u.trim().toLowerCase())
                        .filter(Boolean);
                    return list.includes(docUuid);
                });

                if (notasActivas.length > 0) {
                    return res.status(400).json({
                        message: `No se puede cancelar la factura porque tiene ${notasActivas.length} Nota(s) de Crédito / Devolución vigente(s) aplicada(s). Cancela primero la Nota de Crédito.`
                    });
                }
            }
        }

        // 1. Si el documento está timbrado ante el SAT, solicitar cancelación al PAC Profact (CancelaCFDIAck40)
        let pacResult = { success: true, mensaje: 'Documento sin timbrar cancelado localmente.' };
        if (documento.estado_sat === 'Timbrado' && documento.uuid) {
            pacResult = await cancelarCFDIPAC(
                documento.Emisor,
                documento.uuid,
                motivoCancelacion,
                motivoCancelacion === '01' ? uuidSustClean : ''
            );

            if (!pacResult.success) {
                return res.status(400).json({
                    success: false,
                    message: pacResult.mensaje || 'El PAC/SAT rechazó la solicitud de cancelación.',
                    codigo: pacResult.codigo
                });
            }
        }

        // 2. Actualizar el estado del documento a Cancelado
        await documento.update({
            estado_sat: 'Cancelado',
            estado_pago: 'Cancelado',
            saldo_insoluto: 0,
            motivo_cancelacion: motivoCancelacion,
            uuid_sustitucion: motivoCancelacion === '01' ? uuidSustClean : null,
            fecha_cancelacion: new Date(),
            acuse_cancelacion: pacResult.acuse || null
        });

        const saldosRestaurados = [];

        // 3. Si el documento cancelado es una Nota de Crédito / Devolución ('E'), revertir su descuento en el saldo insoluto de la(s) factura(s) de Ingreso ('I') original(es)
        if (documento.tipo_comprobante === 'E' && documento.uuids_relacionados) {
            const targetUuids = String(documento.uuids_relacionados)
                .split(/[\n,;]+/)
                .map(u => u.trim())
                .filter(Boolean);

            if (targetUuids.length > 0) {
                const facturasOrigen = await Documento.findAll({
                    where: {
                        emisor_id: documento.emisor_id,
                        tipo_comprobante: 'I',
                        uuid: { [Op.in]: targetUuids }
                    }
                });

                const montoNota = round2(documento.total);
                for (const fac of facturasOrigen) {
                    if (fac.estado_sat === 'Cancelado') continue;
                    const totalFac = round2(fac.total);
                    const saldoActual = round2(fac.saldo_insoluto !== null ? fac.saldo_insoluto : 0);
                    let nuevoSaldo = Math.min(totalFac, round2(saldoActual + montoNota));
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

                    saldosRestaurados.push({
                        id: fac.id,
                        folio: `${fac.serie || 'A'}-${fac.folio || fac.id}`,
                        saldo_nuevo: nuevoSaldo,
                        estado_pago: nuevoEstadoPago
                    });
                }
            }
        }

        // 4. Si el documento cancelado es un Complemento de Pago ('P'), marcar el Pago como Cancelado y revertir el saldo insoluto de las facturas de Ingreso asociadas
        if (documento.tipo_comprobante === 'P') {
            const pagoPadre = await Pago.findOne({
                where: { documento_rep_id: documento.id }
            });

            if (pagoPadre && pagoPadre.estado !== 'Cancelado') {
                await pagoPadre.update({
                    estado: 'Cancelado',
                    motivo_cancelacion: motivoCancelacion,
                    fecha_cancelacion: new Date()
                });

                const relacionesPago = await PagoDocumento.findAll({
                    where: { pago_id: pagoPadre.id },
                    include: [Documento]
                });

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

                    saldosRestaurados.push({
                        id: fac.id,
                        folio: `${fac.serie || 'A'}-${fac.folio || fac.id}`,
                        saldo_nuevo: nuevoSaldo,
                        estado_pago: nuevoEstadoPago
                    });
                }
            }
        }

        // 5. Regenerar el PDF para que refleje el estado Cancelado
        try {
            const lineas = await DetalleDocumento.findAll({
                where: { documento_id: documento.id },
                include: [{ model: Concepto, include: [Impuesto] }]
            });
            const pdfRes = await generarPDF(documento, documento.Emisor, documento.Receptor, lineas);
            if (pdfRes?.success) {
                await documento.update({ pdf_url: pdfRes.pdfUrl });
            }
        } catch (pdfErr) {
            console.warn('Aviso al regenerar PDF tras cancelación:', pdfErr.message);
        }

        res.json({
            success: true,
            message: pacResult.mensaje || 'Comprobante cancelado exitosamente.',
            documento,
            saldosRestaurados
        });
    } catch (error) {
        console.error('Error al cancelar documento:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error interno al procesar la cancelación del documento.'
        });
    }
};
