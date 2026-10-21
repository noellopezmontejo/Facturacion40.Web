import { ImpuestoLocal } from '../models/index.js';
import { Op } from 'sequelize';

export const getImpuestosLocales = async (req, res) => {
    try {
        const whereClause = { activo: true };
        
        // Si no es Administrador, solo ve los globales (null) o los de su propia empresa
        if (req.usuario.rol !== 'Administrador') {
            whereClause[Op.or] = [
                { empresa_id: null },
                { empresa_id: req.usuario.empresa_id }
            ];
        }

        const impuestos = await ImpuestoLocal.findAll({
            where: whereClause,
            order: [['nombre', 'ASC']]
        });
        res.json(impuestos);
    } catch (error) {
        console.error('Error fetching local taxes:', error);
        res.status(500).json({ message: 'Error al obtener impuestos locales' });
    }
};

export const createImpuestoLocal = async (req, res) => {
    try {
        const data = { ...req.body };
        // Si no es administrador global, forzar su empresa_id del token
        if (req.usuario.rol !== 'Administrador') {
            data.empresa_id = req.usuario.empresa_id;
        } else {
            // Un admin global puede asignar empresa_id de forma opcional (si no se envía, es global)
            if (data.empresa_id === '') data.empresa_id = null;
        }

        const nuevo = await ImpuestoLocal.create(data);
        res.status(201).json(nuevo);
    } catch (error) {
        console.error('Error creating local tax:', error);
        res.status(500).json({ message: 'Error al crear impuesto local' });
    }
};

export const updateImpuestoLocal = async (req, res) => {
    const { id } = req.params;
    try {
        const imp = await ImpuestoLocal.findByPk(id);
        if (!imp) return res.status(404).json({ message: 'No encontrado' });

        // Seguridad multitenant: No administradores solo pueden editar sus propios impuestos creados
        if (req.usuario.rol !== 'Administrador') {
            if (imp.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para modificar este impuesto local.' });
            }
        }

        const data = { ...req.body };
        // Evitar que usuarios alteren la empresa_id de los impuestos
        if (req.usuario.rol !== 'Administrador') {
            delete data.empresa_id;
        }

        await imp.update(data);
        res.json(imp);
    } catch (error) {
        console.error('Error updating local tax:', error);
        res.status(500).json({ message: 'Error al actualizar' });
    }
};

export const deleteImpuestoLocal = async (req, res) => {
    const { id } = req.params;
    try {
        const imp = await ImpuestoLocal.findByPk(id);
        if (!imp) return res.status(404).json({ message: 'No encontrado' });

        // Seguridad multitenant: No administradores solo pueden eliminar sus propios impuestos creados
        if (req.usuario.rol !== 'Administrador') {
            if (imp.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar este impuesto local.' });
            }
        }

        // Borrado lógico para seguridad
        await imp.update({ activo: false });
        res.json({ message: 'Eliminado' });
    } catch (error) {
        console.error('Error deleting local tax:', error);
        res.status(500).json({ message: 'Error al eliminar' });
    }
};
