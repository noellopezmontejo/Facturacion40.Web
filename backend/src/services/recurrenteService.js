import { 
    FacturacionRecurrente, 
    DetalleFacturacionRecurrente, 
    HistorialFacturacionRecurrente,
    Documento, 
    DetalleDocumento, 
    Concepto,
    Impuesto,
    Emisor, 
    Receptor, 
    SerieFolio,
    ConfiguracionEstilo 
} from '../models/index.js';
import { generarXML, firmarXML, timbrarPAC } from './cfdiService.js';
import { generarPDF } from './pdfService.js';
import { enviarFacturaPorCorreo } from './emailService.js';
import { getXmlPath, getPdfPath } from '../utils/storageHelper.js';

const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

/**
 * Reemplaza etiquetas dinámicas en la descripción de los conceptos
 * ej. "Mantenimiento mensual {{MES}} {{AÑO}}" -> "Mantenimiento mensual Noviembre 2026"
 */
export const reemplazarVariablesDinamicas = (texto = '', refDate = new Date()) => {
    if (!texto || typeof texto !== 'string') return '';
    const d = new Date(refDate);
    const mesIndex = d.getMonth();
    const mesActual = MESES_ES[mesIndex];
    const anioActual = d.getFullYear();

    const mesAnteriorIndex = (mesIndex + 11) % 12;
    const mesAnterior = MESES_ES[mesAnteriorIndex];

    const mesSiguienteIndex = (mesIndex + 1) % 12;
    const mesSiguiente = MESES_ES[mesSiguienteIndex];

    const fechaCorta = `${String(d.getDate()).padStart(2, '0')}/${String(mesIndex + 1).padStart(2, '0')}/${anioActual}`;
    const periodo = `${mesActual} ${anioActual}`;

    let resultado = texto;
    resultado = resultado.replace(/\{\{MES\}\}/gi, mesActual);
    resultado = resultado.replace(/\{\{MES_ACTUAL\}\}/gi, mesActual);
    resultado = resultado.replace(/\{\{AÑO\}\}/gi, anioActual);
    resultado = resultado.replace(/\{\{ANIO\}\}/gi, anioActual);
    resultado = resultado.replace(/\{\{MES_ANTERIOR\}\}/gi, mesAnterior);
    resultado = resultado.replace(/\{\{MES_SIGUIENTE\}\}/gi, mesSiguiente);
    resultado = resultado.replace(/\{\{PERIODO\}\}/gi, periodo);
    resultado = resultado.replace(/\{\{FECHA\}\}/gi, fechaCorta);

    return resultado;
};

/**
 * Calcula la siguiente fecha de ejecución a partir de una fecha base
 */
export const calcularProximaFecha = (fechaBase, frecuencia = 'Mensual', diaEjecucion = 1) => {
    const d = new Date(fechaBase);
    // Normalizar a UTC sin hora
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    let nextDate = new Date(year, month, day);

    switch (frecuencia) {
        case 'Semanal':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'Quincenal':
            nextDate.setDate(nextDate.getDate() + 15);
            break;
        case 'Mensual': {
            const targetMonth = month + 1;
            const daysInTargetMonth = new Date(year, targetMonth + 1, 0).getDate();
            const safeDay = Math.min(diaEjecucion || 1, daysInTargetMonth);
            nextDate = new Date(year, targetMonth, safeDay);
            break;
        }
        case 'Bimestral': {
            const targetMonth = month + 2;
            const daysInTargetMonth = new Date(year, targetMonth + 1, 0).getDate();
            const safeDay = Math.min(diaEjecucion || 1, daysInTargetMonth);
            nextDate = new Date(year, targetMonth, safeDay);
            break;
        }
        case 'Trimestral': {
            const targetMonth = month + 3;
            const daysInTargetMonth = new Date(year, targetMonth + 1, 0).getDate();
            const safeDay = Math.min(diaEjecucion || 1, daysInTargetMonth);
            nextDate = new Date(year, targetMonth, safeDay);
            break;
        }
        case 'Semestral': {
            const targetMonth = month + 6;
            const daysInTargetMonth = new Date(year, targetMonth + 1, 0).getDate();
            const safeDay = Math.min(diaEjecucion || 1, daysInTargetMonth);
            nextDate = new Date(year, targetMonth, safeDay);
            break;
        }
        case 'Anual': {
            const targetYear = year + 1;
            const daysInTargetMonth = new Date(targetYear, month + 1, 0).getDate();
            const safeDay = Math.min(diaEjecucion || 1, daysInTargetMonth);
            nextDate = new Date(targetYear, month, safeDay);
            break;
        }
        default:
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
    }

    return nextDate.toISOString().slice(0, 10);
};

/**
 * Ejecuta una suscripción recurrente de forma manual o programada
 */
export const ejecutarSuscripcion = async (suscripcionId, usuarioIdOverride = null) => {
    console.log(`[Recurrente Service] Ejecutando suscripción ID: ${suscripcionId}`);
    
    const suscripcion = await FacturacionRecurrente.findByPk(suscripcionId, {
        include: [
            { model: Emisor },
            { model: Receptor },
            { model: DetalleFacturacionRecurrente, as: 'detalles' }
        ]
    });

    if (!suscripcion) {
        throw new Error(`Suscripción recurrente con ID ${suscripcionId} no encontrada`);
    }

    if (suscripcion.estado === 'Cancelada' || suscripcion.estado === 'Completada') {
        throw new Error(`La suscripción se encuentra en estado "${suscripcion.estado}" y no puede emitirse.`);
    }

    const emisor = suscripcion.Emisor;
    const receptor = suscripcion.Receptor;
    const detalles = suscripcion.detalles || [];

    if (!emisor || !receptor) {
        throw new Error('La suscripción carece de Emisor o Receptor válidos.');
    }

    if (detalles.length === 0) {
        throw new Error('La suscripción no tiene conceptos o partidas configuradas.');
    }

    // 1. Resolver Serie y Folio consecutivo
    const serieName = (suscripcion.serie || 'REC').trim().toUpperCase();
    let serieObj = await SerieFolio.findOne({
        where: {
            emisor_id: emisor.id,
            serie: serieName
        }
    });

    if (!serieObj) {
        serieObj = await SerieFolio.create({
            emisor_id: emisor.id,
            serie: serieName,
            ultimo_folio: 0
        });
    }

    const nextFolio = (serieObj.ultimo_folio || 0) + 1;
    await serieObj.update({ ultimo_folio: nextFolio });

    const executionDate = new Date();

    // 2. Crear registro principal en Documento
    const metodoPago = suscripcion.metodo_pago || 'PUE';
    const totalDoc = parseFloat(suscripcion.total || 0);

    const nuevoDocumento = await Documento.create({
        emisor_id: emisor.id,
        receptor_id: receptor.id,
        usuario_id: usuarioIdOverride || suscripcion.usuario_id,
        tipo_documento_id: 1, // Factura
        tipo_comprobante: suscripcion.tipo_comprobante || 'I',
        fecha: executionDate,
        forma_pago: suscripcion.forma_pago || '03',
        metodo_pago: metodoPago,
        uso_cfdi: suscripcion.uso_cfdi || 'G03',
        moneda: suscripcion.moneda || 'MXN',
        tipo_cambio: parseFloat(suscripcion.tipo_cambio || 1),
        subtotal: parseFloat(suscripcion.subtotal || 0),
        descuento: parseFloat(suscripcion.descuento || 0),
        total_impuestos_trasladados: parseFloat(suscripcion.total_impuestos_trasladados || 0),
        total_impuestos_retenidos: parseFloat(suscripcion.total_impuestos_retenidos || 0),
        total: totalDoc,
        serie: serieName,
        folio: nextFolio,
        saldo_insoluto: metodoPago === 'PPD' ? totalDoc : 0,
        estado_pago: metodoPago === 'PUE' ? 'Pagado' : 'Pendiente',
        estado_sat: 'No Timbrado'
    });

    // 3. Crear y asociar partidas en detalle_documentos
    const lineasToInsert = [];
    for (let idx = 0; idx < detalles.length; idx++) {
        const det = detalles[idx];
        const cant = parseFloat(det.cantidad || 1);
        const precio = parseFloat(det.valor_unitario || 0);
        const desc = parseFloat(det.descuento || 0);
        const imp = parseFloat(det.importe !== undefined ? det.importe : (cant * precio));
        const descripcionDinamica = reemplazarVariablesDinamicas(det.descripcion, executionDate);

        let conceptoId = det.concepto_id;
        if (conceptoId) {
            const cExist = await Concepto.findByPk(conceptoId);
            if (!cExist) conceptoId = null;
        }

        if (!conceptoId) {
            let matched = await Concepto.findOne({
                where: {
                    emisor_id: emisor.id,
                    descripcion: descripcionDinamica
                }
            });
            if (!matched) {
                matched = await Concepto.create({
                    emisor_id: emisor.id,
                    clave_prod_serv: det.clave_prod_serv || '84111500',
                    clave_unidad: det.clave_unidad || 'E48',
                    unidad: det.unidad || 'Servicio',
                    no_identificacion: det.no_identificacion || `REC-ITEM-${idx + 1}`,
                    descripcion: descripcionDinamica,
                    valor_unitario: precio,
                    descuento: desc
                });
            }
            conceptoId = matched.id;
        }

        const retIva = det.impuestos_retenidos && det.impuestos_retenidos.some(r => r.impuesto === '002');
        const retIsr = det.impuestos_retenidos && det.impuestos_retenidos.some(r => r.impuesto === '001');

        lineasToInsert.push({
            documento_id: nuevoDocumento.id,
            concepto_id: conceptoId,
            cantidad: cant,
            valor_unitario: precio,
            importe: Math.round((cant * precio - desc) * 100) / 100,
            descuento: desc,
            es_objeto_imp: det.objeto_imp || '02',
            retencion_iva: !!retIva,
            retencion_isr: !!retIsr,
            retencion_isr_tasa: 0.10
        });
    }
    await DetalleDocumento.bulkCreate(lineasToInsert);

    // Cargar lineas con Conceptos e Impuestos para generación de XML y PDF
    const lineasDetalle = await DetalleDocumento.findAll({
        where: { documento_id: nuevoDocumento.id },
        include: [{ model: Concepto, include: [Impuesto] }]
    });

    // 5. Timbrado automático ante el SAT / PAC si está habilitado
    let timbradoExitoso = false;
    let timbradoResult = null;
    let mensajeLog = 'Factura creada exitosamente en modo borrador.';

    if (suscripcion.auto_timbrar) {
        try {
            console.log(`[Recurrente Service] Procediendo al timbrado automático de Factura Folio: ${serieName}-${nextFolio}`);
            const xmlGenerado = await generarXML(nuevoDocumento, emisor, receptor, lineasDetalle);
            const xmlFirmado = await firmarXML(xmlGenerado, emisor.id);
            timbradoResult = await timbrarPAC(xmlFirmado, emisor);

            await nuevoDocumento.update({
                uuid: timbradoResult.uuid,
                estado_sat: 'Timbrado',
                xml_url: timbradoResult.xmlTimbradoUrl,
                fecha_timbrado: timbradoResult.fechaTimbrado || new Date()
            });

            timbradoExitoso = true;
            mensajeLog = `Timbrado SAT exitoso. UUID: ${timbradoResult.uuid}`;
            console.log(`[Recurrente Service] ${mensajeLog}`);

            // Generar PDF timbrado
            const estilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: emisor.id } }) || {};
            const pdfRes = await generarPDF(nuevoDocumento, emisor, receptor, lineasDetalle, estilo);
            if (pdfRes?.pdfUrl) {
                await nuevoDocumento.update({ pdf_url: pdfRes.pdfUrl });
            }

            // Enviar por correo si está habilitado
            if (suscripcion.enviar_email && receptor.correo) {
                try {
                    const xmlPath = getXmlPath(emisor.rfc, timbradoResult.uuid);
                    const pdfPath = getPdfPath(emisor.rfc, timbradoResult.uuid);
                    await enviarFacturaPorCorreo(nuevoDocumento, receptor, xmlPath, pdfPath);
                    console.log(`[Recurrente Service] Factura enviada por correo a ${receptor.correo}`);
                } catch (emailErr) {
                    console.warn(`[Recurrente Service] No se pudo enviar el correo automático: ${emailErr.message}`);
                }
            }
        } catch (timbradoError) {
            console.error('[Recurrente Service] Error en timbrado SAT:', timbradoError);
            mensajeLog = `Error al timbrar ante el SAT: ${timbradoError.message}`;
            // Guardar documento sin timbrar para permitir timbrado posterior
        }
    } else {
        // Generar PDF de borrador
        try {
            const estilo = await ConfiguracionEstilo.findOne({ where: { emisor_id: emisor.id } }) || {};
            const pdfRes = await generarPDF(nuevoDocumento, emisor, receptor, lineasDetalle, estilo);
            if (pdfRes?.pdfUrl) {
                await nuevoDocumento.update({ pdf_url: pdfRes.pdfUrl });
            }
        } catch (errPdf) {
            console.warn('[Recurrente Service] Error en PDF borrador:', errPdf.message);
        }
    }

    // 6. Registrar en el Historial de la Suscripción
    const historialItem = await HistorialFacturacionRecurrente.create({
        facturacion_recurrente_id: suscripcion.id,
        documento_id: nuevoDocumento.id,
        fecha_ejecucion: executionDate,
        folio_generado: `${serieName}-${nextFolio}`,
        uuid: nuevoDocumento.uuid || null,
        estado: timbradoExitoso ? 'Timbrado' : (suscripcion.auto_timbrar ? 'Error' : 'Borrador'),
        total: totalDoc,
        mensaje: mensajeLog
    });

    // 7. Calcular y programar siguiente fecha de emisión
    const nextDate = calcularProximaFecha(suscripcion.proxima_emision || executionDate, suscripcion.frecuencia, suscripcion.dia_ejecucion);
    let nuevoEstado = suscripcion.estado;

    if (suscripcion.fecha_fin && new Date(nextDate) > new Date(suscripcion.fecha_fin)) {
        nuevoEstado = 'Completada';
        console.log(`[Recurrente Service] Suscripción ${suscripcion.id} ha alcanzado su fecha fin (${suscripcion.fecha_fin}). Marcada como Completada.`);
    }

    await suscripcion.update({
        ultima_emision: executionDate,
        proxima_emision: nextDate,
        total_facturas_emitidas: (suscripcion.total_facturas_emitidas || 0) + 1,
        estado: nuevoEstado
    });

    return {
        success: true,
        documento: nuevoDocumento,
        timbrado: timbradoExitoso,
        uuid: nuevoDocumento.uuid,
        proxima_emision: nextDate,
        historial: historialItem,
        mensaje: mensajeLog
    };
};

/**
 * Busca y procesa automáticamente todas las suscripciones activas cuya próxima emisión <= hoy
 */
export const procesarSuscripcionesPendientes = async () => {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);
        console.log(`[Recurrente Service] Verificando suscripciones recurrentes pendientes para: ${todayStr}`);

        const { Op } = await import('sequelize');
        const pendientes = await FacturacionRecurrente.findAll({
            where: {
                estado: 'Activa',
                proxima_emision: {
                    [Op.lte]: todayStr
                }
            }
        });

        console.log(`[Recurrente Service] Se encontraron ${pendientes.length} suscripciones pendientes de emisión.`);

        const resultados = [];
        for (const suscripcion of pendientes) {
            try {
                const res = await ejecutarSuscripcion(suscripcion.id);
                resultados.push({ id: suscripcion.id, success: true, res });
            } catch (err) {
                console.error(`[Recurrente Service] Error procesando suscripción ${suscripcion.id}:`, err);
                resultados.push({ id: suscripcion.id, success: false, error: err.message });
            }
        }

        return {
            total: pendientes.length,
            resultados
        };
    } catch (error) {
        console.error('[Recurrente Service] Error general al procesar suscripciones pendientes:', error);
        throw error;
    }
};
