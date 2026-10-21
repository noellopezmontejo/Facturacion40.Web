import { Cotizacion, DetalleCotizacion, Emisor, Receptor, Concepto, Impuesto } from '../models/index.js';

export const getCotizaciones = async (req, res) => {
    try {
        const { emisorId } = req.query;
        let where = {};
        if (emisorId) where.emisor_id = emisorId;

        const cotizaciones = await Cotizacion.findAll({
            where,
            include: [
                { model: Emisor, attributes: ['id', 'razon_social', 'rfc'] },
                { model: Receptor, attributes: ['id', 'razon_social', 'rfc'] }
            ],
            order: [['fecha', 'DESC']]
        });
        res.json(cotizaciones);
    } catch (error) {
        console.error('Error fetching cotizaciones:', error);
        res.status(500).json({ message: 'Error al obtener cotizaciones', error: error.message, stack: error.stack });
    }
};

export const getCotizacionById = async (req, res) => {
    try {
        const { id } = req.params;
        const cotizacion = await Cotizacion.findByPk(id, {
            include: [
                { model: Emisor },
                { model: Receptor },
                { 
                    model: DetalleCotizacion, 
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
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });
        res.json(cotizacion);
    } catch (error) {
        console.error('Error fetching cotizacion:', error);
        res.status(500).json({ message: 'Error al obtener cotización' });
    }
};

export const createCotizacion = async (req, res) => {
    try {
        const { detalles, ...cotizacionData } = req.body;
        cotizacionData.usuario_id = req.usuario.id;
        
        const nuevaCotizacion = await Cotizacion.create(cotizacionData);
        
        if (detalles && detalles.length > 0) {
            const detallesConCotizacionId = detalles.map(det => ({
                ...det,
                cotizacion_id: nuevaCotizacion.id
            }));
            await DetalleCotizacion.bulkCreate(detallesConCotizacionId);
        }
        
        res.status(201).json(nuevaCotizacion);
    } catch (error) {
        console.error('Error creating cotizacion:', error);
        res.status(500).json({ message: 'Error al crear cotización' });
    }
};

export const updateCotizacionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, documento_id } = req.body;
        
        const cotizacion = await Cotizacion.findByPk(id);
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });
        
        cotizacion.estado = estado;
        if (documento_id) cotizacion.documento_id = documento_id;
        
        await cotizacion.save();
        res.json(cotizacion);
    } catch (error) {
        console.error('Error updating cotizacion:', error);
        res.status(500).json({ message: 'Error al actualizar cotización' });
    }
};
