import { Documento, DetalleDocumento, Emisor, Receptor, Concepto, Impuesto, SerieFolio } from '../models/index.js';
import { generarXML, firmarXML, timbrarPAC } from '../services/cfdiService.js';
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

        // Recalcular Subtotal, Descuento y Total de Impuestos
        let computedSubtotal = 0;
        let computedDescuento = 0;
        let totalIVA = 0;
        let totalRet = 0;

        const lineasMap = (detalles || []).map(det => {
            const qty = parseFloat(det.cantidad) || 0;
            const price = parseFloat(det.valor_unitario) || 0;
            const desc = parseFloat(det.descuento) || 0;
            const baseAmount = (qty * price) - desc;

            computedSubtotal += (qty * price);
            computedDescuento += desc;

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
                    const impAmt = tipoFactor === 'Exento' ? 0 : Math.round(baseAmount * tasa * 100) / 100;
                    totalIVA += impAmt;
                });

                if (itemRetIsr) {
                    totalRet += Math.round(baseAmount * parseFloat(itemRetIsrTasa) * 100) / 100;
                }
                if (itemRetIva) {
                    totalRet += Math.round(baseAmount * 0.106667 * 100) / 100;
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
                        totalTrasladosLocales += parseFloat(t.importe || 0);
                    });
                }
                if (il && il.retenciones && Array.isArray(il.retenciones)) {
                    il.retenciones.forEach(r => {
                        totalRetencionesLocales += parseFloat(r.importe || 0);
                    });
                }
            } catch (e) {
                console.error("Error parsing local taxes:", e);
            }
        }

        const finalSubtotal = ajuste_manual ? parseFloat(subtotal) : computedSubtotal;
        const finalTraslados = ajuste_manual ? parseFloat(total_impuestos_trasladados) : totalIVA;
        const finalRetenciones = ajuste_manual ? parseFloat(total_impuestos_retenidos) : totalRet;
        const finalTotal = ajuste_manual ? parseFloat(total) : (computedSubtotal - computedDescuento + totalIVA - totalRet + totalTrasladosLocales - totalRetencionesLocales);

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

        enviarFacturaPorCorreo(nuevoDocumento, receptor, timbrado.xmlTimbradoUrl, pdfResult.pdfUrl)
            .catch(err => console.error("Error correo:", err));

        res.status(201).json({
            message: 'Factura generada y timbrada exitosamente.',
            documento: nuevoDocumento
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
            details: error.errors || error.stack
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

        // Enviar Correo
        enviarFacturaPorCorreo(documento, receptor, timbrado.xmlTimbradoUrl, pdfResult.pdfUrl)
            .catch(err => console.error("Error enviando correo en background:", err));

        res.json({
            message: 'Documento timbrado exitosamente.',
            documento
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
            details: error.errors || error.stack
        });
    }
};

export const getDocumentos = async (req, res) => {
    const { emisorId } = req.query; // Filtro
    try {
        let whereClause = {};
        if (emisorId) whereClause.emisor_id = emisorId;

        // Si no es super admin, limitar por usuario (Opcional, depende reglas)

        const documentos = await Documento.findAll({
            where: whereClause,
            include: [
                { model: Receptor, attributes: ['razon_social', 'rfc'] }
            ],
            order: [['fecha', 'DESC']]
        });

        res.json(documentos);
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
