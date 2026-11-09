import { 
    FacturacionRecurrente, 
    DetalleFacturacionRecurrente, 
    HistorialFacturacionRecurrente, 
    Documento, 
    Emisor, 
    Receptor, 
    Concepto 
} from '../models/index.js';
import { ejecutarSuscripcion, procesarSuscripcionesPendientes, calcularProximaFecha } from '../services/recurrenteService.js';
import { Op } from 'sequelize';

export const getRecurrentes = async (req, res) => {
    try {
        const { emisorId, estado, search } = req.query;
        let where = {};
        if (emisorId) where.emisor_id = emisorId;
        if (estado && estado !== 'Todos') where.estado = estado;

        if (search) {
            where[Op.or] = [
                { nombre_suscripcion: { [Op.like]: `%${search}%` } },
                { serie: { [Op.like]: `%${search}%` } }
            ];
        }

        const recurrentes = await FacturacionRecurrente.findAll({
            where,
            include: [
                { model: Emisor, attributes: ['id', 'razon_social', 'rfc'] },
                { model: Receptor, attributes: ['id', 'razon_social', 'rfc', 'correo'] }
            ],
            order: [
                ['estado', 'ASC'], // Activas primero
                ['proxima_emision', 'ASC']
            ]
        });

        res.json(recurrentes);
    } catch (error) {
        console.error('Error fetching recurrentes:', error);
        res.status(500).json({ message: 'Error al obtener suscripciones recurrentes', error: error.message });
    }
};

export const getRecurrenteById = async (req, res) => {
    try {
        const { id } = req.params;
        const recurrente = await FacturacionRecurrente.findByPk(id, {
            include: [
                { model: Emisor },
                { model: Receptor },
                { 
                    model: DetalleFacturacionRecurrente, 
                    as: 'detalles',
                    include: [{ model: Concepto, attributes: ['id', 'descripcion', 'no_identificacion'] }]
                },
                {
                    model: HistorialFacturacionRecurrente,
                    as: 'historial',
                    include: [{ model: Documento, as: 'documento', attributes: ['id', 'uuid', 'serie', 'folio', 'pdf_url', 'xml_url', 'estado_sat'] }]
                }
            ],
            order: [
                [{ model: HistorialFacturacionRecurrente, as: 'historial' }, 'fecha_ejecucion', 'DESC']
            ]
        });

        if (!recurrente) {
            return res.status(404).json({ message: 'Suscripción recurrente no encontrada' });
        }

        res.json(recurrente);
    } catch (error) {
        console.error('Error fetching recurrente detail:', error);
        res.status(500).json({ message: 'Error al obtener detalle de suscripción recurrente', error: error.message });
    }
};

export const createRecurrente = async (req, res) => {
    try {
        const { detalles, ...recurrenteData } = req.body;
        recurrenteData.usuario_id = req.usuario.id;

        // Calcular primera fecha de emisión si no viene provista
        if (!recurrenteData.proxima_emision) {
            const startDate = recurrenteData.fecha_inicio || new Date().toISOString().slice(0, 10);
            recurrenteData.proxima_emision = startDate;
        }

        // Calcular totales de los conceptos si no vienen en el payload
        let subtotal = 0;
        let descuento = 0;
        let totalTraslados = 0;
        let totalRetenciones = 0;

        const lineas = (detalles || []).map((det, idx) => {
            const cant = parseFloat(det.cantidad || 1);
            const precio = parseFloat(det.valor_unitario || 0);
            const desc = parseFloat(det.descuento || 0);
            const imp = parseFloat(det.importe !== undefined ? det.importe : (cant * precio));
            const base = Math.max(0, imp - desc);

            subtotal += imp;
            descuento += desc;

            let traslados = det.impuestos_trasladados;
            if (!traslados && det.iva !== 0) {
                const ivaAmt = Math.round(base * 0.16 * 100) / 100;
                traslados = [{ impuesto: '002', tipo: 'Traslado', tasa: '0.160000', importe: ivaAmt }];
            }

            if (Array.isArray(traslados)) {
                traslados.forEach(t => {
                    totalTraslados += parseFloat(t.importe || 0);
                });
            }

            return {
                concepto_id: det.concepto_id || null,
                clave_prod_serv: det.clave_prod_serv || '84111500',
                no_identificacion: det.no_identificacion || null,
                cantidad: cant,
                clave_unidad: det.clave_unidad || 'E48',
                unidad: det.unidad || 'Servicio',
                descripcion: det.descripcion || `Concepto Recurrente ${idx + 1}`,
                valor_unitario: precio,
                importe: imp,
                descuento: desc,
                objeto_imp: det.objeto_imp || '02',
                impuestos_trasladados: traslados || [],
                impuestos_retenidos: det.impuestos_retenidos || []
            };
        });

        recurrenteData.subtotal = recurrenteData.subtotal !== undefined ? parseFloat(recurrenteData.subtotal) : subtotal;
        recurrenteData.descuento = recurrenteData.descuento !== undefined ? parseFloat(recurrenteData.descuento) : descuento;
        recurrenteData.total_impuestos_trasladados = recurrenteData.total_impuestos_trasladados !== undefined ? parseFloat(recurrenteData.total_impuestos_trasladados) : totalTraslados;
        recurrenteData.total_impuestos_retenidos = recurrenteData.total_impuestos_retenidos !== undefined ? parseFloat(recurrenteData.total_impuestos_retenidos) : totalRetenciones;
        recurrenteData.total = recurrenteData.total !== undefined ? parseFloat(recurrenteData.total) : (recurrenteData.subtotal - recurrenteData.descuento + recurrenteData.total_impuestos_trasladados - recurrenteData.total_impuestos_retenidos);

        const nuevaSuscripcion = await FacturacionRecurrente.create(recurrenteData);

        if (lineas.length > 0) {
            const lineasConId = lineas.map(l => ({
                ...l,
                facturacion_recurrente_id: nuevaSuscripcion.id
            }));
            await DetalleFacturacionRecurrente.bulkCreate(lineasConId);
        }

        res.status(201).json({
            success: true,
            message: 'Suscripción recurrente creada exitosamente',
            recurrente: nuevaSuscripcion
        });
    } catch (error) {
        console.error('Error creating recurrente:', error);
        res.status(500).json({ message: 'Error al crear suscripción recurrente', error: error.message });
    }
};

export const updateRecurrente = async (req, res) => {
    try {
        const { id } = req.params;
        const { detalles, ...updateData } = req.body;

        const recurrente = await FacturacionRecurrente.findByPk(id);
        if (!recurrente) {
            return res.status(404).json({ message: 'Suscripción recurrente no encontrada' });
        }

        const allowedFields = [
            'nombre_suscripcion', 'frecuencia', 'dia_ejecucion', 'fecha_inicio', 'fecha_fin',
            'proxima_emision', 'estado', 'auto_timbrar', 'enviar_email', 'tipo_comprobante',
            'serie', 'forma_pago', 'metodo_pago', 'uso_cfdi', 'moneda', 'tipo_cambio', 'observaciones'
        ];

        allowedFields.forEach(field => {
            if (updateData[field] !== undefined) {
                recurrente[field] = updateData[field];
            }
        });

        if (detalles && Array.isArray(detalles)) {
            await DetalleFacturacionRecurrente.destroy({ where: { facturacion_recurrente_id: recurrente.id } });

            let subtotal = 0;
            let descuento = 0;
            let totalTraslados = 0;
            let totalRetenciones = 0;

            const lineas = detalles.map((det, idx) => {
                const cant = parseFloat(det.cantidad || 1);
                const precio = parseFloat(det.valor_unitario || 0);
                const desc = parseFloat(det.descuento || 0);
                const imp = parseFloat(det.importe !== undefined ? det.importe : (cant * precio));
                const base = Math.max(0, imp - desc);

                subtotal += imp;
                descuento += desc;

                let traslados = det.impuestos_trasladados;
                if (!traslados && det.iva !== 0) {
                    const ivaAmt = Math.round(base * 0.16 * 100) / 100;
                    traslados = [{ impuesto: '002', tipo: 'Traslado', tasa: '0.160000', importe: ivaAmt }];
                }

                if (Array.isArray(traslados)) {
                    traslados.forEach(t => {
                        totalTraslados += parseFloat(t.importe || 0);
                    });
                }

                return {
                    facturacion_recurrente_id: recurrente.id,
                    concepto_id: det.concepto_id || null,
                    clave_prod_serv: det.clave_prod_serv || '84111500',
                    no_identificacion: det.no_identificacion || null,
                    cantidad: cant,
                    clave_unidad: det.clave_unidad || 'E48',
                    unidad: det.unidad || 'Servicio',
                    descripcion: det.descripcion || `Concepto Recurrente ${idx + 1}`,
                    valor_unitario: precio,
                    importe: imp,
                    descuento: desc,
                    objeto_imp: det.objeto_imp || '02',
                    impuestos_trasladados: traslados || [],
                    impuestos_retenidos: det.impuestos_retenidos || []
                };
            });

            if (lineas.length > 0) {
                await DetalleFacturacionRecurrente.bulkCreate(lineas);
            }

            recurrente.subtotal = updateData.subtotal !== undefined ? parseFloat(updateData.subtotal) : subtotal;
            recurrente.descuento = updateData.descuento !== undefined ? parseFloat(updateData.descuento) : descuento;
            recurrente.total_impuestos_trasladados = updateData.total_impuestos_trasladados !== undefined ? parseFloat(updateData.total_impuestos_trasladados) : totalTraslados;
            recurrente.total_impuestos_retenidos = updateData.total_impuestos_retenidos !== undefined ? parseFloat(updateData.total_impuestos_retenidos) : totalRetenciones;
            recurrente.total = updateData.total !== undefined ? parseFloat(updateData.total) : (recurrente.subtotal - recurrente.descuento + recurrente.total_impuestos_trasladados - recurrente.total_impuestos_retenidos);
        }

        await recurrente.save();

        res.json({
            success: true,
            message: 'Suscripción recurrente actualizada exitosamente',
            recurrente
        });
    } catch (error) {
        console.error('Error updating recurrente:', error);
        res.status(500).json({ message: 'Error al actualizar suscripción recurrente' });
    }
};

export const updateRecurrenteEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const recurrente = await FacturacionRecurrente.findByPk(id);
        if (!recurrente) return res.status(404).json({ message: 'Suscripción no encontrada' });

        recurrente.estado = estado;
        await recurrente.save();

        res.json({ success: true, estado: recurrente.estado });
    } catch (error) {
        console.error('Error updating estado:', error);
        res.status(500).json({ message: 'Error al cambiar estado' });
    }
};

export const ejecutarRecurrenteManual = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await ejecutarSuscripcion(id, req.usuario.id);
        res.json({
            success: true,
            message: result.mensaje || 'Factura recurrente emitida exitosamente',
            ...result
        });
    } catch (error) {
        console.error('Error ejecutando suscripción manual:', error);
        res.status(500).json({ message: error.message || 'Error al emitir factura recurrente' });
    }
};

export const deleteRecurrente = async (req, res) => {
    try {
        const { id } = req.params;
        const recurrente = await FacturacionRecurrente.findByPk(id);
        if (!recurrente) return res.status(404).json({ message: 'Suscripción no encontrada' });

        await recurrente.destroy();
        res.json({ success: true, message: 'Suscripción eliminada' });
    } catch (error) {
        console.error('Error deleting recurrente:', error);
        res.status(500).json({ message: 'Error al eliminar suscripción' });
    }
};

export const procesarPendientesBatch = async (req, res) => {
    try {
        const resultado = await procesarSuscripcionesPendientes();
        res.json({
            success: true,
            message: `Se procesaron ${resultado.total} suscripciones pendientes`,
            ...resultado
        });
    } catch (error) {
        console.error('Error procesando lote de suscripciones pendientes:', error);
        res.status(500).json({ message: 'Error al procesar suscripciones pendientes', error: error.message });
    }
};

export const getRecurrentesStats = async (req, res) => {
    try {
        const { emisorId } = req.query;
        let where = {};
        if (emisorId) where.emisor_id = emisorId;

        const all = await FacturacionRecurrente.findAll({ where });

        const activas = all.filter(r => r.estado === 'Activa');
        const pausadas = all.filter(r => r.estado === 'Pausada');
        const canceladas = all.filter(r => r.estado === 'Cancelada');

        const montoMensualProyectado = activas.reduce((acc, r) => {
            const tot = parseFloat(r.total || 0);
            if (r.frecuencia === 'Mensual') return acc + tot;
            if (r.frecuencia === 'Quincenal') return acc + (tot * 2);
            if (r.frecuencia === 'Semanal') return acc + (tot * 4);
            if (r.frecuencia === 'Bimestral') return acc + (tot / 2);
            if (r.frecuencia === 'Trimestral') return acc + (tot / 3);
            if (r.frecuencia === 'Semestral') return acc + (tot / 6);
            if (r.frecuencia === 'Anual') return acc + (tot / 12);
            return acc + tot;
        }, 0);

        const totalFacturasEmitidas = all.reduce((acc, r) => acc + (parseInt(r.total_facturas_emitidas || 0)), 0);

        // Próximas emisiones dentro de los siguientes 7 días
        const today = new Date();
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        const todayStr = today.toISOString().slice(0, 10);
        const next7DaysStr = next7Days.toISOString().slice(0, 10);

        const proximas = activas.filter(r => r.proxima_emision >= todayStr && r.proxima_emision <= next7DaysStr);

        res.json({
            totalSuscripciones: all.length,
            activas: activas.length,
            pausadas: pausadas.length,
            canceladas: canceladas.length,
            montoMensualProyectado: Math.round(montoMensualProyectado * 100) / 100,
            totalFacturasEmitidas,
            proximasEn7Dias: proximas.length
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};
