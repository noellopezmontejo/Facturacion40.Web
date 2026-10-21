import { Receptor, Emisor } from '../models/index.js';

export const getReceptoresByEmisor = async (req, res) => {
    const { emisorId } = req.params;
    try {
        let receptores;
        if (req.usuario.rol === 'Administrador') {
            const emisor = await Emisor.findByPk(emisorId);
            if (emisor && emisor.empresa_id) {
                // Compartido a nivel espacio empresarial para el Administrador
                receptores = await Receptor.findAll({
                    include: [{
                        model: Emisor,
                        where: { empresa_id: emisor.empresa_id },
                        attributes: []
                    }],
                    order: [['razon_social', 'ASC']]
                });
            } else {
                receptores = await Receptor.findAll({ 
                    where: { emisor_id: emisorId },
                    order: [['razon_social', 'ASC']]
                });
            }
        } else {
            // Compartido a nivel empresa (espacio empresarial) para Usuario Empresarial y Operador
            receptores = await Receptor.findAll({
                include: [{
                    model: Emisor,
                    where: { empresa_id: req.usuario.empresa_id },
                    attributes: [] // No queremos retornar campos del emisor en el objeto
                }],
                order: [['razon_social', 'ASC']]
            });
        }
        res.json(receptores);
    } catch (error) {
        console.error('Error fetching receptores:', error);
        res.status(500).json({ message: 'Error al obtener receptores' });
    }
};


export const createReceptor = async (req, res) => {
    try {
        const newReceptor = await Receptor.create(req.body);
        res.status(201).json(newReceptor);
    } catch (error) {
        console.error('Error creating receptor:', error);
        res.status(500).json({ message: 'Error al crear receptor' });
    }
};

export const updateReceptor = async (req, res) => {
    const { id } = req.params;
    try {
        const receptor = await Receptor.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!receptor) return res.status(404).json({ message: 'Receptor no encontrado' });

        // Seguridad multitenant: Si no es Administrador, debe pertenecer a la misma empresa (espacio empresarial)
        if (req.usuario.rol !== 'Administrador') {
            if (!receptor.Emisor || receptor.Emisor.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para modificar este receptor.' });
            }
        }

        await receptor.update(req.body);
        res.json(receptor);
    } catch (error) {
        console.error('Error updating receptor:', error);
        res.status(500).json({ message: 'Error al actualizar receptor' });
    }
};

export const deleteReceptor = async (req, res) => {
    const { id } = req.params;
    try {
        const receptor = await Receptor.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!receptor) return res.status(404).json({ message: 'Receptor no encontrado' });

        // Seguridad multitenant: Si no es Administrador, debe pertenecer a la misma empresa (espacio empresarial)
        if (req.usuario.rol !== 'Administrador') {
            if (!receptor.Emisor || receptor.Emisor.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar este receptor.' });
            }
        }

        await receptor.destroy();
        res.json({ message: 'Receptor eliminado' });
    } catch (error) {
        console.error('Error deleting receptor:', error);
        res.status(500).json({ message: 'Error al eliminar receptor' });
    }
};
