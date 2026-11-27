import { CatChofer } from '../models/index.js';
import { Op } from 'sequelize';
import { getAuthorizedEmisorIds, canAccessEmisorId } from '../middleware/auth.js';

export const getChoferes = async (req, res) => {
    try {
        const allowedIds = await getAuthorizedEmisorIds(req, req.query.emisor_id);
        const whereClause = allowedIds !== null
            ? { emisor_id: { [Op.in]: allowedIds } }
            : (req.query.emisor_id ? { emisor_id: req.query.emisor_id } : {});
        const choferes = await CatChofer.findAll({ where: whereClause });
        res.json(choferes);
    } catch (error) {
        console.error('Error fetching choferes:', error);
        res.status(500).json({ message: 'Error obteniendo catálogo de choferes.' });
    }
};

export const createChofer = async (req, res) => {
    try {
        if (!(await canAccessEmisorId(req, req.body.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para registrar choferes en este emisor.' });
        }
        const nuevo = await CatChofer.create({ ...req.body, emisor_id: req.body.emisor_id });
        res.status(201).json(nuevo);
    } catch (error) {
        console.error('Error creando chofer:', error);
        res.status(500).json({ message: 'Error creando chofer.', details: error.message });
    }
};

export const updateChofer = async (req, res) => {
    try {
        const chofer = await CatChofer.findByPk(req.params.id);
        if (!chofer) return res.status(404).json({ message: 'Chofer no encontrado' });
        if (!(await canAccessEmisorId(req, chofer.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para modificar este chofer.' });
        }
        await chofer.update(req.body);
        res.json(chofer);
    } catch (error) {
        console.error('Error actualizando chofer:', error);
        res.status(500).json({ message: 'Error actualizando chofer.' });
    }
};

export const deleteChofer = async (req, res) => {
    try {
        const chofer = await CatChofer.findByPk(req.params.id);
        if (!chofer) return res.status(404).json({ message: 'Chofer no encontrado' });
        if (!(await canAccessEmisorId(req, chofer.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para eliminar este chofer.' });
        }
        await chofer.destroy();
        res.json({ message: 'Chofer eliminado.' });
    } catch (error) {
        console.error('Error eliminando chofer:', error);
        res.status(500).json({ message: 'Error eliminando chofer.' });
    }
};
