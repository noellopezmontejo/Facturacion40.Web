import { Concepto, Impuesto, Emisor } from '../models/index.js';

export const getConceptosByEmisor = async (req, res) => {
    const { emisorId } = req.params;
    try {
        let conceptos;
        if (req.usuario.rol === 'Administrador') {
            const emisor = await Emisor.findByPk(emisorId);
            if (emisor && emisor.empresa_id) {
                // Compartido a nivel espacio empresarial para el Administrador
                conceptos = await Concepto.findAll({
                    include: [
                        { model: Impuesto },
                        {
                            model: Emisor,
                            where: { empresa_id: emisor.empresa_id },
                            attributes: []
                        }
                    ],
                    order: [['descripcion', 'ASC']]
                });
            } else {
                conceptos = await Concepto.findAll({
                    where: { emisor_id: emisorId },
                    include: [{ model: Impuesto }],
                    order: [['descripcion', 'ASC']]
                });
            }
        } else {
            // Compartido a nivel empresa (espacio empresarial) para Usuario Empresarial y Operador
            conceptos = await Concepto.findAll({
                include: [
                    { model: Impuesto },
                    {
                        model: Emisor,
                        where: { empresa_id: req.usuario.empresa_id },
                        attributes: [] // No retornar campos del emisor
                    }
                ],
                order: [['descripcion', 'ASC']]
            });
        }
        res.json(conceptos);
    } catch (error) {
        console.error('Error fetching conceptos:', error);
        res.status(500).json({ message: 'Error al obtener conceptos' });
    }
};


export const createConcepto = async (req, res) => {
    const { impuestosIds, ...conceptoData } = req.body;
    try {
        const newConcepto = await Concepto.create(conceptoData);

        if (impuestosIds && impuestosIds.length > 0) {
            const impuestos = await Impuesto.findAll({ where: { id: impuestosIds } });
            await newConcepto.setImpuestos(impuestos);
        }

        res.status(201).json(newConcepto);
    } catch (error) {
        console.error('Error creating concepto:', error);
        res.status(500).json({ message: 'Error al crear concepto' });
    }
};

export const updateConcepto = async (req, res) => {
    const { id } = req.params;
    const { impuestosIds, ...conceptoData } = req.body;
    try {
        const concepto = await Concepto.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!concepto) return res.status(404).json({ message: 'Concepto no encontrado' });

        // Seguridad multitenant: Si no es Administrador, debe pertenecer a la misma empresa (espacio empresarial)
        if (req.usuario.rol !== 'Administrador') {
            if (!concepto.Emisor || concepto.Emisor.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para modificar este concepto.' });
            }
        }

        await concepto.update(conceptoData);

        if (impuestosIds) {
            const impuestos = await Impuesto.findAll({ where: { id: impuestosIds } });
            await concepto.setImpuestos(impuestos);
        }

        res.json(concepto);
    } catch (error) {
        console.error('Error updating concepto:', error);
        res.status(500).json({ message: 'Error al actualizar concepto' });
    }
};

export const deleteConcepto = async (req, res) => {
    const { id } = req.params;
    try {
        const concepto = await Concepto.findByPk(id, {
            include: [{ model: Emisor }]
        });
        if (!concepto) return res.status(404).json({ message: 'Concepto no encontrado' });

        // Seguridad multitenant: Si no es Administrador, debe pertenecer a la misma empresa (espacio empresarial)
        if (req.usuario.rol !== 'Administrador') {
            if (!concepto.Emisor || concepto.Emisor.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar este concepto.' });
            }
        }

        await concepto.destroy();
        res.json({ message: 'Concepto eliminado' });
    } catch (error) {
        console.error('Error deleting concepto:', error);
        res.status(500).json({ message: 'Error al eliminar concepto' });
    }
};
