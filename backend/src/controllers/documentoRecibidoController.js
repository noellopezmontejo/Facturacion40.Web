import { Proveedor, DocumentoRecibido, PagoRecibido, PagoDocumentoRecibido, Emisor } from '../models/index.js';
import { parseCFDI } from '../services/xmlParserService.js';
import { solicitarDescargaMasivaSAT } from '../services/descargaSatService.js';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';

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
 * Solicita una descarga masiva al SAT (Simulación/Mock).
 */
export const solicitarDescargaSAT = async (req, res) => {
    const { emisor_id, fecha_inicio, fecha_fin } = req.body;

    try {
        const emisor = await Emisor.findByPk(emisor_id);
        if (!emisor) {
            return res.status(404).json({ message: 'Emisor del sistema no encontrado' });
        }

        const params = {
            rfcReceptor: emisor.rfc,
            fechaInicio: fecha_inicio,
            fechaFin: fecha_fin
        };

        const resultado = await solicitarDescargaMasivaSAT(params, {
            cer: emisor.certificado_path,
            key: emisor.llave_privada_path
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error al solicitar descarga SAT:', error);
        res.status(500).json({ message: 'Error al conectar con el webservice del SAT', error: error.message });
    }
};
