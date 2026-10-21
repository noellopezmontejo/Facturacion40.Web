import { Impuesto } from '../models/index.js';
import { Op } from 'sequelize';

export const getImpuestos = async (req, res) => {
    try {
        const whereClause = {};
        
        // Si no es Administrador, solo ve los globales (null) o los de su propia empresa
        if (req.usuario.rol !== 'Administrador') {
            whereClause[Op.or] = [
                { empresa_id: null },
                { empresa_id: req.usuario.empresa_id }
            ];
        }

        const impuestos = await Impuesto.findAll({
            where: whereClause,
            order: [['descripcion', 'ASC']]
        });
        res.json(impuestos);
    } catch (error) {
        console.error('Error fetching impuestos:', error);
        res.status(500).json({ message: 'Error al obtener impuestos' });
    }
};

export const createImpuesto = async (req, res) => {
    try {
        const data = { ...req.body };
        // Si no es administrador global, forzar su empresa_id del token
        if (req.usuario.rol !== 'Administrador') {
            data.empresa_id = req.usuario.empresa_id;
        } else {
            // Un admin global puede asignar empresa_id de forma opcional (si no se envía, es global)
            if (data.empresa_id === '') data.empresa_id = null;
        }

        const newImpuesto = await Impuesto.create(data);
        res.status(201).json(newImpuesto);
    } catch (error) {
        console.error('Error creating impuesto:', error);
        res.status(500).json({ message: 'Error al crear impuesto' });
    }
};

export const updateImpuesto = async (req, res) => {
    const { id } = req.params;
    try {
        const impuesto = await Impuesto.findByPk(id);
        if (!impuesto) return res.status(404).json({ message: 'Impuesto no encontrado' });

        // Seguridad multitenant: No administradores solo pueden editar sus propios impuestos creados
        if (req.usuario.rol !== 'Administrador') {
            if (impuesto.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para modificar este impuesto.' });
            }
        }

        const data = { ...req.body };
        // Evitar que usuarios alteren la empresa_id de los impuestos
        if (req.usuario.rol !== 'Administrador') {
            delete data.empresa_id;
        }

        await impuesto.update(data);
        res.json(impuesto);
    } catch (error) {
        console.error('Error updating impuesto:', error);
        res.status(500).json({ message: 'Error al actualizar impuesto' });
    }
};

export const deleteImpuesto = async (req, res) => {
    const { id } = req.params;
    try {
        const impuesto = await Impuesto.findByPk(id);
        if (!impuesto) return res.status(404).json({ message: 'Impuesto no encontrado' });

        // Seguridad multitenant: No administradores solo pueden eliminar sus propios impuestos creados
        if (req.usuario.rol !== 'Administrador') {
            if (impuesto.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar este impuesto.' });
            }
        }

        await impuesto.destroy();
        res.json({ message: 'Impuesto eliminado' });
    } catch (error) {
        console.error('Error deleting impuesto:', error);
        res.status(500).json({ message: 'Error al eliminar impuesto' });
    }
};
