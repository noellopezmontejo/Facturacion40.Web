import { 
    Proveedor, 
    DocumentoRecibido, 
    PagoRecibido, 
    PagoDocumentoRecibido, 
    Emisor,
    SolicitudDescargaSat 
} from '../models/index.js';
import { parseCFDI } from '../services/xmlParserService.js';
import { 
    solicitarDescargaMasivaSAT, 
    consultarEstatusDescarga, 
    descargarPaqueteXMLs, 
    resolverCredenciales 
} from '../services/descargaSatService.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import fs from 'fs';
import { getFielCerPath, getFielKeyPath, getXmlPath, getPublicUrl } from '../utils/storageHelper.js';

/**
 * Helper para recalcular el saldo y estado de pago de una factura recibida.
 */
const recalcularSaldoFacturaRecibida = async (documentoRecibidoId) => {
    const doc = await DocumentoRecibido.findByPk(documentoRecibidoId);
    if (!doc) return;

    // Si es PUE, siempre está pagado en su totalidad y su saldo es 0
    if (doc.metodo_pago === 'PUE') {
        doc.saldo_insoluto = 0;
        doc.estado_pago = 'Pagado';
        await doc.save();
        return;
    }

    // Si es PPD, sumar todos los pagos recibidos asociados en la tabla relacional
    const pagosDocs = await PagoDocumentoRecibido.findAll({
        where: { documento_recibido_id: documentoRecibidoId }
    });

    const totalPagado = pagosDocs.reduce((sum, pd) => sum + parseFloat(pd.imp_pagado), 0);
    const totalFactura = parseFloat(doc.total);
    const nuevoSaldo = Math.max(0, totalFactura - totalPagado);

    doc.saldo_insoluto = nuevoSaldo;

    if (nuevoSaldo <= 0.01) { // Margen de centavos
        doc.estado_pago = 'Pagado';
    } else if (totalPagado > 0) {
        doc.estado_pago = 'Pago Parcial';
    } else {
        doc.estado_pago = 'Pendiente';
    }

    await doc.save();
};

/**
 * Carga e importa archivos XML de CFDIs recibidos.
 */
export const importarXMLs = async (req, res) => {
    const { emisor_id } = req.body; // Emisor del sistema (Receptor en los XMLs)
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No se subieron archivos XML' });
    }

    let defaultEmisorId = emisor_id ? parseInt(emisor_id, 10) : null;
    
    // Si no viene emisor_id, tomamos el primero registrado en el sistema
    if (!defaultEmisorId) {
        const primerEmisor = await Emisor.findOne();
        if (primerEmisor) {
            defaultEmisorId = primerEmisor.id;
        } else {
            return res.status(400).json({ message: 'No hay emisores registrados en el sistema para asociar los documentos' });
        }
    }

    const t = await sequelize.transaction();

    const resultados = {
        exitosos: 0,
        errores: 0,
        detalles: []
    };

    try {
        for (const file of files) {
            const filename = file.originalname;
            try {
                const xmlString = file.buffer.toString('utf8');
                const cfdiData = await parseCFDI(xmlString);

                // 1. Validar receptor (debe ser un Emisor de nuestro sistema)
                let activeEmisor = await Emisor.findOne({ 
                    where: { rfc: cfdiData.receptor.rfc },
                    transaction: t
                });

                const emisorIdToUse = activeEmisor ? activeEmisor.id : defaultEmisorId;

                // 2. Buscar o crear Proveedor
                const [proveedor] = await Proveedor.findOrCreate({
                    where: { 
                        rfc: cfdiData.emisor.rfc, 
                        emisor_id: emisorIdToUse 
                    },
                    defaults: {
                        razon_social: cfdiData.emisor.nombre || 'Proveedor Desconocido',
                        regimen_fiscal: cfdiData.emisor.regimenFiscal
                    },
                    transaction: t
                });

                // 3. Procesar según Tipo de Comprobante
                if (cfdiData.tipoComprobante === 'I') {
                    // Factura de ingreso (compra o gasto)
                    let doc = await DocumentoRecibido.findOne({ 
                        where: { uuid: cfdiData.uuid },
                        transaction: t 
                    });

                    const saldoInicial = cfdiData.metodoPago === 'PUE' ? 0 : cfdiData.total;
                    const estadoPagoInicial = cfdiData.metodoPago === 'PUE' ? 'Pagado' : 'Pendiente';

                    if (doc) {
                        // Si ya existía (quizás como borrador creado por un pago), actualizar datos completos
                        doc.serie = cfdiData.serie;
                        doc.folio = cfdiData.folio;
                        doc.fecha = cfdiData.fecha;
                        doc.forma_pago = cfdiData.formaPago;
                        doc.metodo_pago = cfdiData.metodoPago;
                        doc.moneda = cfdiData.moneda;
                        doc.tipo_cambio = cfdiData.tipoCambio;
                        doc.subtotal = cfdiData.subtotal;
                        doc.descuento = cfdiData.descuento;
                        doc.total = cfdiData.total;
                        doc.proveedor_id = proveedor.id;
                        doc.emisor_id = emisorIdToUse;
                        await doc.save({ transaction: t });
                    } else {
                        // Crear nuevo documento recibido
                        doc = await DocumentoRecibido.create({
                            emisor_id: emisorIdToUse,
                            proveedor_id: proveedor.id,
                            uuid: cfdiData.uuid,
                            serie: cfdiData.serie,
                            folio: cfdiData.folio,
                            fecha: cfdiData.fecha,
                            forma_pago: cfdiData.formaPago,
                            metodo_pago: cfdiData.metodoPago,
                            moneda: cfdiData.moneda,
                            tipo_cambio: cfdiData.tipoCambio,
                            subtotal: cfdiData.subtotal,
                            descuento: cfdiData.descuento,
                            total: cfdiData.total,
                            saldo_insoluto: saldoInicial,
                            estado_pago: estadoPagoInicial
                        }, { transaction: t });
                    }

                    // Recalcular saldo por si se cargaron complementos de pago antes que la factura
                    await recalcularSaldoFacturaRecibida(doc.id);

                    resultados.exitosos++;
                    resultados.detalles.push({ filename, uuid: cfdiData.uuid, tipo: 'Ingreso', status: 'OK' });

                } else if (cfdiData.tipoComprobante === 'P') {
                    // Complemento de pago (REP)
                    let pago = await PagoRecibido.findOne({ 
                        where: { uuid: cfdiData.uuid },
                        transaction: t 
                    });

                    // Si no existe, crear registro principal de Pago
                    if (!pago) {
                        // Sumamos el monto total de todos los nodos de pago
                        const montoTotal = cfdiData.pagos.reduce((sum, p) => sum + p.monto, 0);
                        const primerPago = cfdiData.pagos[0] || {};

                        pago = await PagoRecibido.create({
                            emisor_id: emisorIdToUse,
                            proveedor_id: proveedor.id,
                            uuid: cfdiData.uuid,
                            fecha_pago: primerPago.fechaPago || cfdiData.fecha,
                            monto_total: montoTotal,
                            forma_pago_p: primerPago.formaPagoP || '99',
                            moneda_p: primerPago.monedaP || 'MXN',
                            tipo_cambio_p: primerPago.tipoCambioP || 1
                        }, { transaction: t });

                        // Registrar cada relación con facturas
                        for (const pagoItem of cfdiData.pagos) {
                            for (const docRelacionado of pagoItem.documentosRelacionados) {
                                // Buscar factura relacionada en documentos_recibidos
                                let factura = await DocumentoRecibido.findOne({ 
                                    where: { uuid: docRelacionado.idDocumento },
                                    transaction: t 
                                });

                                // Si la factura no existe en BD, crear un esqueleto/borrador temporal
                                if (!factura) {
                                    factura = await DocumentoRecibido.create({
                                        emisor_id: emisorIdToUse,
                                        proveedor_id: proveedor.id,
                                        uuid: docRelacionado.idDocumento,
                                        fecha: pagoItem.fechaPago,
                                        subtotal: 0,
                                        total: docRelacionado.impPagado + docRelacionado.impSaldoInsoluto, // Estimación
                                        saldo_insoluto: docRelacionado.impSaldoInsoluto,
                                        metodo_pago: 'PPD',
                                        estado_pago: 'Pago Parcial'
                                    }, { transaction: t });
                                }

                                // Crear relación Pago-Documento
                                await PagoDocumentoRecibido.findOrCreate({
                                    where: { 
                                        pago_recibido_id: pago.id, 
                                        documento_recibido_id: factura.id 
                                    },
                                    defaults: {
                                        imp_pagado: docRelacionado.impPagado,
                                        imp_saldo_insoluto: docRelacionado.impSaldoInsoluto,
                                        num_parcialidad: docRelacionado.numParcialidad
                                    },
                                    transaction: t
                                });

                                // Recalcular saldo de factura
                                await recalcularSaldoFacturaRecibida(factura.id);
                            }
                        }
                    }

                    resultados.exitosos++;
                    resultados.detalles.push({ filename, uuid: cfdiData.uuid, tipo: 'Pago (Complemento)', status: 'OK' });
                } else {
                    resultados.errores++;
                    resultados.detalles.push({ filename, error: `Tipo de comprobante no soportado para cuentas por pagar: ${cfdiData.tipoComprobante}` });
                }

            } catch (err) {
                console.error(`Error procesando archivo ${filename}:`, err);
                resultados.errores++;
                resultados.detalles.push({ filename, error: err.message });
            }
        }

        await t.commit();
        res.json({ message: 'Procesamiento masivo finalizado', resultados });
    } catch (error) {
        await t.rollback();
        console.error('Error general en importación de XMLs:', error);
        res.status(500).json({ message: 'Error general al procesar lote de XMLs', error: error.message });
    }
};

/**
 * Obtiene el listado de facturas recibidas de proveedores (Cuentas por Pagar).
 */
export const getDocumentosRecibidos = async (req, res) => {
    const { emisor_id, proveedor_id, estado_pago, metodo_pago, search } = req.query;

    try {
        const whereClause = {};

        if (emisor_id) whereClause.emisor_id = emisor_id;
        if (proveedor_id) whereClause.proveedor_id = proveedor_id;
        if (estado_pago) whereClause.estado_pago = estado_pago;
        if (metodo_pago) whereClause.metodo_pago = metodo_pago;

        if (search) {
            whereClause[Op.or] = [
                { uuid: { [Op.like]: `%${search}%` } },
                { folio: { [Op.like]: `%${search}%` } },
                { serie: { [Op.like]: `%${search}%` } }
            ];
        }

        const documentos = await DocumentoRecibido.findAll({
            where: whereClause,
            include: [
                { model: Proveedor, attributes: ['rfc', 'razon_social'] },
                {
                    model: PagoRecibido,
                    through: { attributes: ['imp_pagado', 'imp_saldo_insoluto', 'num_parcialidad'] }
                }
            ],
            order: [['fecha', 'DESC']]
        });

        res.json(documentos);
    } catch (error) {
        console.error('Error fetching documentos recibidos:', error);
        res.status(500).json({ message: 'Error al obtener las facturas de proveedores' });
    }
};

/**
 * Obtiene el resumen financiero de cuentas por pagar.
 */
export const getResumenCuentasPorPagar = async (req, res) => {
    const { emisor_id } = req.query;
    try {
        const whereClause = {};
        if (emisor_id) whereClause.emisor_id = emisor_id;

        // 1. Obtener todas las facturas recibidas de tipo PPD y PUE
        const documentos = await DocumentoRecibido.findAll({
            where: whereClause,
            include: [{ model: Proveedor, attributes: ['razon_social'] }]
        });

        // 2. Calcular montos
        let totalCuentasPorPagar = 0; // Saldo insoluto total
        let totalPagado = 0;
        let totalFacturado = 0;
        let pendientesCount = 0;
        let pagadasCount = 0;

        const distribucionFormasPago = {};

        documentos.forEach(d => {
            const totalVal = parseFloat(d.total || 0);
            const saldoVal = parseFloat(d.saldo_insoluto !== null ? d.saldo_insoluto : totalVal);

            totalFacturado += totalVal;
            
            if (d.metodo_pago === 'PUE') {
                totalPagado += totalVal;
                pagadasCount++;
                // Registrar forma de pago de factura PUE
                if (d.forma_pago) {
                    distribucionFormasPago[d.forma_pago] = (distribucionFormasPago[d.forma_pago] || 0) + totalVal;
                }
            } else {
                totalCuentasPorPagar += saldoVal;
                totalPagado += (totalVal - saldoVal);
                if (saldoVal <= 0.01) {
                    pagadasCount++;
                } else {
                    pendientesCount++;
                }
            }
        });

        // 3. Agregar desglose de formas de pago desde los complementos de pago recibidos
        const pagos = await PagoRecibido.findAll({
            where: whereClause
        });

        pagos.forEach(p => {
            const montoVal = parseFloat(p.monto_total || 0);
            if (p.forma_pago_p) {
                distribucionFormasPago[p.forma_pago_p] = (distribucionFormasPago[p.forma_pago_p] || 0) + montoVal;
            }
        });

        // Convertir distribución a un array para gráficos
        const formasPagoArray = Object.keys(distribucionFormasPago).map(key => ({
            forma_pago: key,
            monto: distribucionFormasPago[key]
        })).sort((a, b) => b.monto - a.monto);

        res.json({
            resumen: {
                totalFacturado,
                totalCuentasPorPagar,
                totalPagado,
                pendientesCount,
                pagadasCount
            },
            formasPago: formasPagoArray
        });

    } catch (error) {
        console.error('Error in getResumenCuentasPorPagar:', error);
        res.status(500).json({ message: 'Error al obtener resumen de cuentas por pagar' });
    }
};

/**
 * Solicita una descarga masiva al SAT (Directo Web Service / FIEL / CSD).
 */
export const solicitarDescargaSAT = async (req, res) => {
    const { emisor_id, fecha_inicio, fecha_fin, password_fiel, guardar_fiel } = req.body;

    try {
        const emisor = await Emisor.findByPk(emisor_id);
        if (!emisor) {
            return res.status(404).json({ message: 'Emisor del sistema no encontrado' });
        }

        let customCreds = null;
        if (req.files && req.files['fiel_cer'] && req.files['fiel_key']) {
            const cerBuffer = req.files['fiel_cer'][0].buffer;
            const keyBuffer = req.files['fiel_key'][0].buffer;
            const fielPass = password_fiel || emisor.password_fiel || emisor.password_csd || '';
            customCreds = {
                cerBuffer,
                keyBuffer,
                password: fielPass
            };

            // Si el usuario marcó guardar la e.firma para no tener que subirla en cada petición
            if (guardar_fiel === 'true' || guardar_fiel === true) {
                const fielCerPath = getFielCerPath(emisor.rfc);
                const fielKeyPath = getFielKeyPath(emisor.rfc);
                fs.writeFileSync(fielCerPath, cerBuffer);
                fs.writeFileSync(fielKeyPath, keyBuffer);
                emisor.fiel_certificado_path = `/storage/${emisor.rfc}/fiel/fiel.cer`;
                emisor.fiel_llave_privada_path = `/storage/${emisor.rfc}/fiel/fiel.key`;
                if (password_fiel) emisor.password_fiel = password_fiel;
                await emisor.save();
            }
        }

        let creds;
        try {
            creds = resolverCredenciales(emisor, customCreds);
        } catch (cErr) {
            return res.status(400).json({ 
                message: `No se pudieron cargar los certificados de firma (${emisor.rfc}): ${cErr.message}. Verifica tus archivos .cer y .key.` 
            });
        }

        const params = {
            rfcSolicitante: emisor.rfc,
            rfcReceptor: emisor.rfc,
            fechaInicio: fecha_inicio,
            fechaFin: fecha_fin,
            tipoSolicitud: 'CFDI'
        };

        const resultado = await solicitarDescargaMasivaSAT(params, creds);

        // Guardar la solicitud en base de datos para seguimiento y descarga
        const nuevaSolicitud = await SolicitudDescargaSat.create({
            emisor_id: emisor.id,
            id_solicitud_sat: resultado.solicitudId,
            rfc_solicitante: emisor.rfc,
            rfc_receptor: emisor.rfc,
            fecha_inicio: fecha_inicio,
            fecha_fin: fecha_fin,
            tipo_solicitud: 'CFDI',
            tipo_descarga: 'Recibidos',
            estado_sat: resultado.estado || 'Aceptada',
            codigo_estado: resultado.codigoEstado || '5000',
            mensaje_sat: resultado.mensaje || 'Solicitud recibida por el SAT'
        });

        res.json({
            ...resultado,
            id: nuevaSolicitud.id,
            solicitud: nuevaSolicitud
        });
    } catch (error) {
        console.error('Error al solicitar descarga SAT:', error);
        res.status(500).json({ message: 'Error al conectar con el webservice del SAT', error: error.message });
    }
};

/**
 * Obtiene el historial de solicitudes de descarga masiva SAT de un emisor
 */
export const getSolicitudesDescarga = async (req, res) => {
    const { emisor_id } = req.query;
    try {
        const whereClause = emisor_id ? { emisor_id: Number(emisor_id) } : {};
        const solicitudes = await SolicitudDescargaSat.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        res.json(solicitudes);
    } catch (error) {
        console.error('Error obteniendo solicitudes de descarga SAT:', error);
        res.status(500).json({ message: 'Error al consultar historial de solicitudes' });
    }
};

/**
 * Consulta y actualiza el estatus de una solicitud ante el SAT (VerificaSolicitudDescarga)
 */
export const verificarSolicitudSAT = async (req, res) => {
    const { id } = req.params;
    try {
        const solicitud = await SolicitudDescargaSat.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!solicitud) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        const emisor = solicitud.Emisor || await Emisor.findByPk(solicitud.emisor_id);
        const creds = resolverCredenciales(emisor);

        const estatus = await consultarEstatusDescarga(solicitud.id_solicitud_sat, emisor.rfc, creds);

        if (estatus.success) {
            solicitud.estado_sat = estatus.estado || solicitud.estado_sat;
            solicitud.codigo_estado = estatus.codigoEstado || solicitud.codigo_estado;
            solicitud.mensaje_sat = estatus.mensaje || solicitud.mensaje_sat;
            if (estatus.numeroCFDIs) {
                solicitud.numero_cfdis = estatus.numeroCFDIs;
            }
            if (estatus.paquetesIds && estatus.paquetesIds.length > 0) {
                solicitud.paquetes_ids = estatus.paquetesIds;
            }
            await solicitud.save();
        }

        res.json({
            success: true,
            solicitud,
            estatus
        });
    } catch (error) {
        console.error('Error verificando solicitud SAT:', error);
        res.status(500).json({ message: 'Error al consultar estatus en el SAT', error: error.message });
    }
};

/**
 * Simula la finalización de paquetes en Modo Prueba para permitir probar la descarga e importación.
 */
export const simularPaquetesPrueba = async (req, res) => {
    const { id } = req.params;
    try {
        const solicitud = await SolicitudDescargaSat.findByPk(id);
        if (!solicitud) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        solicitud.estado_sat = 'Terminada';
        solicitud.codigo_estado = '5000';
        solicitud.numero_cfdis = 2;
        solicitud.paquetes_ids = [`DEMO-PKG-${Date.now()}`];
        solicitud.mensaje_sat = 'Paquete de prueba generado (Modo Prueba). Listo para descargar e importar a Cuentas por Pagar.';
        await solicitud.save();

        res.json({
            success: true,
            message: 'Paquete de prueba generado exitosamente. Ya puedes descargar e importar.',
            solicitud
        });
    } catch (error) {
        console.error('Error simulando paquetes prueba:', error);
        res.status(500).json({ message: 'Error al simular paquete', error: error.message });
    }
};

/**
 * Descarga los paquetes generados por el SAT, descomprime los XMLs e ingesta las facturas y pagos recibidos
 */
export const descargarEImportarPaquetesSAT = async (req, res) => {
    const { id } = req.params;
    try {
        const solicitud = await SolicitudDescargaSat.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!solicitud) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

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
                message: `El SAT aún no ha generado los paquetes de descarga para esta solicitud (Estatus: ${solicitud.estado_sat}). Intenta verificar en unos momentos.` 
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

                        // Buscar o crear Proveedor
                        const [proveedor] = await Proveedor.findOrCreate({
                            where: { rfc: cfdiData.emisor.rfc, emisor_id: emisor.id },
                            defaults: {
                                razon_social: cfdiData.emisor.nombre || 'Proveedor Desconocido',
                                regimen_fiscal: cfdiData.emisor.regimenFiscal
                            }
                        });

                        if (['I', 'E', 'N'].includes(cfdiData.tipoComprobante)) {
                            const isNomina = cfdiData.tipoComprobante === 'N';
                            const metodoPagoVal = isNomina ? 'PUE' : (cfdiData.metodoPago || 'PUE');
                            const formaPagoVal = cfdiData.formaPago || (isNomina ? '99' : '03');

                            const [doc, created] = await DocumentoRecibido.findOrCreate({
                                where: { uuid: cfdiData.uuid },
                                defaults: {
                                    emisor_id: emisor.id,
                                    proveedor_id: proveedor.id,
                                    uuid: cfdiData.uuid,
                                    serie: cfdiData.serie,
                                    folio: cfdiData.folio,
                                    fecha: cfdiData.fecha,
                                    forma_pago: formaPagoVal,
                                    metodo_pago: metodoPagoVal,
                                    moneda: cfdiData.moneda || 'MXN',
                                    tipo_cambio: cfdiData.tipoCambio || 1,
                                    subtotal: cfdiData.subtotal || cfdiData.total,
                                    descuento: cfdiData.descuento || 0,
                                    total: cfdiData.total,
                                    saldo_insoluto: (isNomina || metodoPagoVal === 'PUE') ? 0 : cfdiData.total,
                                    estado_pago: (isNomina || metodoPagoVal === 'PUE') ? 'Pagado' : 'Pendiente'
                                }
                            });

                            // Guardar archivo XML físico para consulta/descarga
                            try {
                                const xmlPath = getXmlPath(emisor.rfc, cfdiData.uuid);
                                fs.writeFileSync(xmlPath, item.contenidoXml, 'utf8');
                                doc.xml_url = getPublicUrl(emisor.rfc, 'xml', `${cfdiData.uuid}.xml`);
                                await doc.save();
                            } catch (writeErr) {
                                console.warn('No se pudo guardar el archivo XML en disco:', writeErr.message);
                            }

                            if (created) facturasImportadas++;
                            await recalcularSaldoFacturaRecibida(doc.id);
                        } else if (cfdiData.tipoComprobante === 'P') {
                            const [pago, created] = await PagoRecibido.findOrCreate({
                                where: { uuid: cfdiData.uuid },
                                defaults: {
                                    emisor_id: emisor.id,
                                    proveedor_id: proveedor.id,
                                    uuid: cfdiData.uuid,
                                    serie: cfdiData.serie,
                                    folio: cfdiData.folio,
                                    fecha_pago: cfdiData.fecha,
                                    forma_pago_p: cfdiData.formaPago || '03',
                                    moneda_p: cfdiData.moneda || 'MXN',
                                    monto: cfdiData.total
                                }
                            });

                            try {
                                const xmlPath = getXmlPath(emisor.rfc, cfdiData.uuid);
                                fs.writeFileSync(xmlPath, item.contenidoXml, 'utf8');
                                pago.xml_url = getPublicUrl(emisor.rfc, 'xml', `${cfdiData.uuid}.xml`);
                                await pago.save();
                            } catch (writeErr) {
                                console.warn('No se pudo guardar XML de pago:', writeErr.message);
                            }

                            if (created) pagosImportados++;
                        }
                    } catch (itemErr) {
                        console.error('Error procesando XML individual:', itemErr.message);
                        erroresImportacion++;
                    }
                }
            } catch (paqErr) {
                console.error(`Error procesando paquete ${paqId}:`, paqErr.message);
            }
        }

        solicitud.estado_sat = 'Descargada';
        solicitud.paquetes_descargados = paquetes;
        await solicitud.save();

        res.json({
            success: true,
            message: `Sincronización SAT completa: ${facturasImportadas} facturas y ${pagosImportados} pagos importados a Cuentas por Pagar.`,
            resumen: {
                totalXMLs,
                facturasImportadas,
                pagosImportados,
                erroresImportacion
            }
        });
    } catch (error) {
        console.error('Error descargando e importando paquetes SAT:', error);
        res.status(500).json({ message: 'Error al descargar e importar paquetes del SAT', error: error.message });
    }
};
