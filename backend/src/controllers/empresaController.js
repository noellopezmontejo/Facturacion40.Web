import { Empresa, Emisor, PlanGlobal } from '../models/index.js';
import { probarConexionSmtp } from '../services/emailService.js';

export const getEmpresas = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden consultar todos los espacios.' });
        }
        const empresas = await Empresa.findAll({
            include: [
                {
                    model: Emisor,
                    attributes: ['id', 'rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal', 'empresa_id', 'modo_prueba', 'es_agapes']
                },
                {
                    model: PlanGlobal,
                    as: 'planGlobal'
                }
            ],
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
    const {
        nombre,
        activo,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_pass,
        smtp_from_name,
        smtp_from_email
    } = req.body;
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
        if (smtp_host !== undefined) updateData.smtp_host = smtp_host;
        if (smtp_port !== undefined) updateData.smtp_port = parseInt(smtp_port) || 587;
        if (smtp_secure !== undefined) updateData.smtp_secure = Boolean(smtp_secure);
        if (smtp_user !== undefined) updateData.smtp_user = smtp_user;
        if (smtp_pass !== undefined && smtp_pass !== '') updateData.smtp_pass = smtp_pass;
        if (smtp_from_name !== undefined) updateData.smtp_from_name = smtp_from_name;
        if (smtp_from_email !== undefined) updateData.smtp_from_email = smtp_from_email;

        await empresa.update(updateData);
        res.json({ message: 'Espacio empresarial actualizado con éxito.', empresa });
    } catch (error) {
        console.error('Error updating empresa:', error);
        res.status(500).json({ message: 'Error al actualizar espacio empresarial.', error: error.message });
    }
};

export const testSmtpEmpresa = async (req, res) => {
    try {
        const {
            smtp_host,
            smtp_port,
            smtp_secure,
            smtp_user,
            smtp_pass,
            smtp_from_name,
            smtp_from_email,
            correo_prueba,
            empresa_id
        } = req.body;

        let passToUse = smtp_pass;
        if (!passToUse && (empresa_id || req.usuario.empresa_id)) {
            const emp = await Empresa.findByPk(empresa_id || req.usuario.empresa_id);
            if (emp?.smtp_pass) passToUse = emp.smtp_pass;
        }

        const result = await probarConexionSmtp({
            smtp_host,
            smtp_port,
            smtp_secure,
            smtp_user,
            smtp_pass: passToUse,
            smtp_from_name,
            smtp_from_email
        }, correo_prueba);

        res.json(result);
    } catch (error) {
        console.error('Error probando SMTP de empresa:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'No se pudo conectar al servidor SMTP.'
        });
    }
};

export const createEmpresa = async (req, res) => {
    const { 
        nombre, 
        plan_codigo = 'negocio', 
        periodo_suscripcion = 'mensual',
        precio_personalizado = null,
        folios_incluidos = null,
        dias_gracia = 30
    } = req.body;
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado. Solo administradores pueden crear espacios de trabajo.' });
        }
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ message: 'El nombre de la empresa es obligatorio.' });
        }

        // Obtener el plan global por defecto para asignar folios y características
        const plan = await PlanGlobal.findOne({ where: { codigo: plan_codigo } });
        const foliosFinales = folios_incluidos !== null ? folios_incluidos : (plan ? plan.folios_mensuales : 200);

        const fechaInicio = new Date();
        const fechaVence = new Date();
        if (periodo_suscripcion === 'anual') {
            fechaVence.setFullYear(fechaInicio.getFullYear() + 1);
        } else {
            fechaVence.setDate(fechaInicio.getDate() + (parseInt(dias_gracia) || 30));
        }

        const nuevaEmpresa = await Empresa.create({
            nombre: nombre.trim(),
            activo: true,
            plan_codigo,
            periodo_suscripcion,
            precio_personalizado: (precio_personalizado !== null && precio_personalizado !== '') ? parseFloat(precio_personalizado) : null,
            folios_incluidos: foliosFinales,
            fecha_inicio: fechaInicio,
            fecha_vencimiento: fechaVence,
            estado_suscripcion: 'activa'
        });
        
        // Retornar la nueva empresa con emisores y plan asociado
        const result = await Empresa.findByPk(nuevaEmpresa.id, {
            include: [
                {
                    model: Emisor,
                    attributes: ['id', 'rfc', 'razon_social', 'regimen_fiscal', 'codigo_postal', 'empresa_id', 'modo_prueba', 'es_agapes']
                },
                {
                    model: PlanGlobal,
                    as: 'planGlobal'
                }
            ]
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating empresa:', error);
        res.status(500).json({ message: 'Error al crear espacio empresarial.', error: error.message });
    }
};


