import { Empresa, Emisor } from '../models/index.js';

export const getEmpresas = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden consultar todos los espacios.' });
        }
        const empresas = await Empresa.findAll({
            include: [{
                model: Emisor,
                attributes: ['id', 'rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal', 'empresa_id', 'modo_prueba', 'es_agapes']
            }],
            order: [['id', 'ASC']]
        });
        res.json(empresas);
    } catch (error) {
        console.error('Error fetching empresas:', error);
        res.status(500).json({ message: 'Error al obtener espacios de trabajo.', error: error.message });
    }
};

export const getMiEmpresa = async (req, res) => {
    try {
        let empresaId = req.usuario.empresa_id;

        if (req.usuario.rol === 'Administrador') {
            // Un admin puede pasar directamente empresa_id o emisor_id
            const queryEmpresaId = req.query.empresa_id || req.query.empresaId;
            const queryEmisorId = req.query.emisor_id || req.query.emisorId;
            
            if (queryEmpresaId) {
                empresaId = Number(queryEmpresaId);
            } else if (queryEmisorId) {
                const emisor = await Emisor.findByPk(queryEmisorId);
                if (emisor) {
                    empresaId = emisor.empresa_id;
                }
            } else {
                // Si el admin no pasa nada, obtener la primera empresa activa por defecto
                const firstEmpresa = await Empresa.findOne({ order: [['id', 'ASC']] });
                if (firstEmpresa) {
                    empresaId = firstEmpresa.id;
                }
            }
        }

        if (!empresaId) {
            return res.status(400).json({ message: 'No se especificó un espacio empresarial.' });
        }

        const empresa = await Empresa.findByPk(empresaId, {
            include: [{
                model: Emisor,
                attributes: ['id', 'rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal', 'empresa_id', 'modo_prueba', 'es_agapes']
            }]
        });

        if (!empresa) {
            return res.status(404).json({ message: 'Espacio empresarial no encontrado.' });
        }

        res.json(empresa);
    } catch (error) {
        console.error('Error fetching empresa:', error);
        res.status(500).json({ message: 'Error al obtener espacio empresarial.', error: error.message });
    }
};

export const updateMiEmpresa = async (req, res) => {
    const { nombre, activo } = req.body;
    try {
        let empresaId = req.usuario.empresa_id;

        if (req.usuario.rol === 'Administrador') {
            const queryEmpresaId = req.query.empresa_id || req.query.empresaId || req.body.empresa_id;
            const queryEmisorId = req.query.emisor_id || req.query.emisorId;
            
            if (queryEmpresaId) {
                empresaId = Number(queryEmpresaId);
            } else if (queryEmisorId) {
                const emisor = await Emisor.findByPk(queryEmisorId);
                if (emisor) {
                    empresaId = emisor.empresa_id;
                }
            }
        }

        if (!empresaId) {
            return res.status(400).json({ message: 'No se especificó un espacio empresarial.' });
        }

        const empresa = await Empresa.findByPk(empresaId);
        if (!empresa) {
            return res.status(404).json({ message: 'Espacio empresarial no encontrado.' });
        }

        const updateData = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (activo !== undefined) updateData.activo = activo;

        await empresa.update(updateData);
        res.json({ message: 'Espacio empresarial actualizado con éxito.', empresa });
    } catch (error) {
        console.error('Error updating empresa:', error);
        res.status(500).json({ message: 'Error al actualizar espacio empresarial.', error: error.message });
    }
};

export const createEmpresa = async (req, res) => {
    const { nombre } = req.body;
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden crear espacios de trabajo.' });
        }
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ message: 'El nombre de la empresa es obligatorio.' });
        }
        const nuevaEmpresa = await Empresa.create({ nombre: nombre.trim(), activo: true });
        
        // Retornar la nueva empresa con emisores vacíos
        const result = await Empresa.findByPk(nuevaEmpresa.id, {
            include: [{
                model: Emisor,
                attributes: ['id', 'rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal', 'empresa_id', 'modo_prueba', 'es_agapes']
            }]
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating empresa:', error);
        res.status(500).json({ message: 'Error al crear espacio empresarial.', error: error.message });
    }
};


