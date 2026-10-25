import { Impuesto } from '../models/index.js';
import { Op } from 'sequelize';

export const DEFAULT_IMPUESTOS = [
    { descripcion: "IVA 16%", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.160000", empresa_id: null },
    { descripcion: "IVA 8% (Fronterizo)", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.080000", empresa_id: null },
    { descripcion: "IVA 0%", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.000000", empresa_id: null },
    { descripcion: "IVA Exento", tipo: "traslado", impuesto_sat: "002", tipo_factor: "Exento", tasa_cuota: "0.000000", empresa_id: null },
    { descripcion: "Retención IVA 10.6667%", tipo: "retencion", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.106667", empresa_id: null },
    { descripcion: "Retención IVA 8%", tipo: "retencion", impuesto_sat: "002", tipo_factor: "Tasa", tasa_cuota: "0.080000", empresa_id: null },
    { descripcion: "Retención ISR 10% (Honorarios)", tipo: "retencion", impuesto_sat: "001", tipo_factor: "Tasa", tasa_cuota: "0.100000", empresa_id: null },
    { descripcion: "Retención ISR 1.25% (RESICO)", tipo: "retencion", impuesto_sat: "001", tipo_factor: "Tasa", tasa_cuota: "0.012500", empresa_id: null },
    { descripcion: "IEPS 8% (Alimentos alto valor calórico)", tipo: "traslado", impuesto_sat: "003", tipo_factor: "Tasa", tasa_cuota: "0.080000", empresa_id: null }
];

export const getImpuestos = async (req, res) => {
    try {
        const whereClause = {};
        const empresaId = req.query.empresa_id || req.usuario?.empresa_id;

        // Si no es Administrador, solo ve los globales (null) o los de su propia empresa
        if (req.usuario?.rol !== 'Administrador') {
            if (empresaId) {
                whereClause[Op.or] = [
                    { empresa_id: null },
                    { empresa_id: empresaId }
                ];
            } else {
                whereClause.empresa_id = null;
            }
        } else if (req.query.empresa_id) {
            whereClause[Op.or] = [
                { empresa_id: null },
                { empresa_id: req.query.empresa_id }
            ];
        }

        let impuestos = await Impuesto.findAll({
            where: whereClause,
            order: [['descripcion', 'ASC']]
        });

        // Si la tabla está vacía en la base de datos, autosembrar los impuestos SAT por defecto
        if (!impuestos || impuestos.length === 0) {
            const totalCount = await Impuesto.count().catch(() => 0);
            if (totalCount === 0) {
                await Impuesto.bulkCreate(DEFAULT_IMPUESTOS).catch(e => console.error("Error auto-seeding impuestos:", e));
                impuestos = await Impuesto.findAll({
                    where: whereClause,
                    order: [['descripcion', 'ASC']]
                });
            }
        }

        // Si aún así no hubiese registros, devolver fallback seguro con IDs
        if (!impuestos || impuestos.length === 0) {
            return res.json(DEFAULT_IMPUESTOS.map((imp, idx) => ({ id: idx + 1, ...imp })));
        }

        res.json(impuestos);
    } catch (error) {
        console.error('Error fetching impuestos, returning defaults:', error);
        res.json(DEFAULT_IMPUESTOS.map((imp, idx) => ({ id: idx + 1, ...imp })));
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
