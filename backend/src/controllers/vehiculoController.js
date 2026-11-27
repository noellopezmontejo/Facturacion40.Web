import { CatVehiculo } from '../models/index.js';
import { Op } from 'sequelize';
import { getAuthorizedEmisorIds, canAccessEmisorId } from '../middleware/auth.js';

export const getVehiculos = async (req, res) => {
    try {
        const allowedIds = await getAuthorizedEmisorIds(req, req.query.emisor_id);
        const whereClause = allowedIds !== null
            ? { emisor_id: { [Op.in]: allowedIds } }
            : (req.query.emisor_id ? { emisor_id: req.query.emisor_id } : {});
        const vehiculos = await CatVehiculo.findAll({ where: whereClause });
        res.json(vehiculos);
    } catch (error) {
        console.error('Error fetching vehículos:', error);
        res.status(500).json({ message: 'Error obteniendo catálogo de vehículos.' });
    }
};

export const createVehiculo = async (req, res) => {
    try {
        if (!(await canAccessEmisorId(req, req.body.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para registrar vehículos en este emisor.' });
        }
        const nuevo = await CatVehiculo.create({ ...req.body, emisor_id: req.body.emisor_id });
        res.status(201).json(nuevo);
    } catch (error) {
        console.error('Error creando vehículo:', error);
        res.status(500).json({ message: 'Error creando vehículo.', details: error.message });
    }
};

export const updateVehiculo = async (req, res) => {
    try {
        const vehiculo = await CatVehiculo.findByPk(req.params.id);
        if (!vehiculo) return res.status(404).json({ message: 'Vehículo no encontrado' });
        if (!(await canAccessEmisorId(req, vehiculo.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para modificar este vehículo.' });
        }
        await vehiculo.update(req.body);
        res.json(vehiculo);
    } catch (error) {
        console.error('Error actualizando vehículo:', error);
        res.status(500).json({ message: 'Error actualizando vehículo.' });
    }
};

export const deleteVehiculo = async (req, res) => {
    try {
        const vehiculo = await CatVehiculo.findByPk(req.params.id);
        if (!vehiculo) return res.status(404).json({ message: 'Vehículo no encontrado' });
        if (!(await canAccessEmisorId(req, vehiculo.emisor_id))) {
            return res.status(403).json({ message: 'No tienes permisos para eliminar este vehículo.' });
        }
        await vehiculo.destroy();
        res.json({ message: 'Vehículo eliminado.' });
    } catch (error) {
        console.error('Error eliminando vehículo:', error);
        res.status(500).json({ message: 'Error eliminando vehículo.' });
    }
};
