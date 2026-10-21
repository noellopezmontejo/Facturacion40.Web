import { OrdenServicio, DetalleOrdenServicio, Emisor, Receptor, Concepto, Impuesto } from '../models/index.js';

export const getOrdenesServicio = async (req, res) => {
    try {
        const { emisorId } = req.query;
        let where = {};
        if (emisorId) where.emisor_id = emisorId;

        const ordenes = await OrdenServicio.findAll({
            where,
            include: [
                { model: Emisor, attributes: ['id', 'razon_social', 'rfc'] },
                { model: Receptor, attributes: ['id', 'razon_social', 'rfc'] }
            ],
            order: [['fecha_ingreso', 'DESC']]
        });
        res.json(ordenes);
    } catch (error) {
        console.error('Error fetching ordenes de servicio:', error);
        res.status(500).json({ message: 'Error al obtener ordenes de servicio', error: error.message, stack: error.stack });
    }
};

export const getOrdenServicioById = async (req, res) => {
    try {
        const { id } = req.params;
        const orden = await OrdenServicio.findByPk(id, {
            include: [
                { model: Emisor },
                { model: Receptor },
                { 
                    model: DetalleOrdenServicio, 
                    as: 'detalles',
                    include: [
                        {
                            model: Concepto,
                            include: [{ model: Impuesto }]
                        }
                    ]
                }
            ]
        });
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });
        res.json(orden);
    } catch (error) {
        console.error('Error fetching orden de servicio:', error);
        res.status(500).json({ message: 'Error al obtener orden de servicio' });
    }
};

export const createOrdenServicio = async (req, res) => {
    try {
        const { detalles, ...ordenData } = req.body;
        ordenData.usuario_id = req.usuario.id;
        
        const nuevaOrden = await OrdenServicio.create(ordenData);
        
        if (detalles && detalles.length > 0) {
            const detallesConOrdenId = detalles.map(det => ({
                ...det,
                orden_servicio_id: nuevaOrden.id
            }));
            await DetalleOrdenServicio.bulkCreate(detallesConOrdenId);
        }
        
        res.status(201).json(nuevaOrden);
    } catch (error) {
        console.error('Error creating orden de servicio:', error);
        res.status(500).json({ message: 'Error al crear orden de servicio' });
    }
};

export const updateOrdenServicioStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, diagnostico_tecnico, fecha_entrega_real, documento_id } = req.body;
        
        const orden = await OrdenServicio.findByPk(id);
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });
        
        if (estado) orden.estado = estado;
        if (diagnostico_tecnico !== undefined) orden.diagnostico_tecnico = diagnostico_tecnico;
        if (fecha_entrega_real) orden.fecha_entrega_real = fecha_entrega_real;
        if (documento_id) orden.documento_id = documento_id;
        
        await orden.save();
        res.json(orden);
    } catch (error) {
        console.error('Error updating orden de servicio:', error);
        res.status(500).json({ message: 'Error al actualizar orden de servicio' });
    }
};

export const addDetallesOrdenServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const detalles = req.body; // Array de detalles
        
        const orden = await OrdenServicio.findByPk(id);
        if (!orden) return res.status(404).json({ message: 'Orden de servicio no encontrada' });
        
        const detallesConOrdenId = detalles.map(det => ({
            ...det,
            orden_servicio_id: orden.id
        }));
        await DetalleOrdenServicio.bulkCreate(detallesConOrdenId);
        
        // Aquí podríamos recalcular los totales de la orden
        
        res.status(201).json({ message: 'Detalles agregados' });
    } catch (error) {
        console.error('Error adding detalles a orden de servicio:', error);
        res.status(500).json({ message: 'Error al agregar detalles' });
    }
};
