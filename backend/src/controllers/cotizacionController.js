import { Cotizacion, DetalleCotizacion, Emisor, Receptor, Concepto, Impuesto } from '../models/index.js';
import { generarPDFCotizacion } from '../services/pdfService.js';
import { Op } from 'sequelize';
import { getAuthorizedEmisorIds, canAccessEmisorId } from '../middleware/auth.js';

export const getCotizaciones = async (req, res) => {
    try {
        const { emisorId } = req.query;
        const allowedIds = await getAuthorizedEmisorIds(req, emisorId);
        let where = {};
        if (allowedIds !== null) {
            where.emisor_id = { [Op.in]: allowedIds };
        } else if (emisorId) {
            where.emisor_id = emisorId;
        }

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
        res.status(500).json({ message: 'Error al obtener cotizaciones', error: error.message });
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
        if (!(await canAccessEmisorId(req, cotizacion.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para consultar esta cotización.' });
        }
        res.json(cotizacion);
    } catch (error) {
        console.error('Error fetching cotizacion:', error);
        res.status(500).json({ message: 'Error al obtener cotización' });
    }
};

export const createCotizacion = async (req, res) => {
    try {
        const { detalles, ...cotizacionData } = req.body;
        if (!(await canAccessEmisorId(req, cotizacionData.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para crear cotizaciones en este emisor.' });
        }
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
        if (!(await canAccessEmisorId(req, cotizacion.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para modificar esta cotización.' });
        }

        cotizacion.estado = estado;
        if (documento_id) cotizacion.documento_id = documento_id;

        await cotizacion.save();
        res.json(cotizacion);
    } catch (error) {
        console.error('Error updating cotizacion:', error);
        res.status(500).json({ message: 'Error al actualizar cotización' });
    }
};

export const getCotizacionPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const cotizacion = await Cotizacion.findByPk(id, { attributes: ['id', 'emisor_id'] });
        if (!cotizacion) return res.status(404).json({ message: 'Cotización no encontrada' });
        if (!(await canAccessEmisorId(req, cotizacion.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para generar el PDF de esta cotización.' });
        }
        const result = await generarPDFCotizacion(id);
        res.json(result);
    } catch (error) {
        console.error('Error generating cotizacion PDF:', error);
        res.status(500).json({ message: 'Error al generar PDF de cotización', error: error.message });
    }
};
