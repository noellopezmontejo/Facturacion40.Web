import { Usuario, Rol, Emisor, Empresa } from '../models/index.js';
import bcrypt from 'bcryptjs';

// Obtener lista de usuarios
export const getUsuarios = async (req, res) => {
    try {
        let usuarios;

        if (req.usuario.rol === 'Administrador') {
            // Administrador ve todos los usuarios del sistema
            usuarios = await Usuario.findAll({
                include: [
                    { model: Rol, attributes: ['id', 'nombre', 'descripcion'] },
                    { model: Emisor, attributes: ['id', 'rfc', 'razon_social'] },
                    { model: Empresa, attributes: ['id', 'nombre'] }
                ]
            });
        } else if (req.usuario.rol === 'Usuario Empresarial') {
            // Usuario Empresarial solo ve usuarios de su propia empresa
            usuarios = await Usuario.findAll({
                where: { empresa_id: req.usuario.empresa_id },
                include: [
                    { model: Rol, attributes: ['id', 'nombre', 'descripcion'] },
                    { model: Emisor, attributes: ['id', 'rfc', 'razon_social'] },
                    { model: Empresa, attributes: ['id', 'nombre'] }
                ]
            });
        } else {
            return res.status(403).json({ message: 'No tienes permisos para ver los usuarios.' });
        }

        // Formatear salida
        const result = usuarios.map(u => ({
            id: u.id,
            nombre: u.nombre,
            email: u.email,
            activo: u.activo,
            empresa_id: u.empresa_id,
            empresaNombre: u.Empresa ? u.Empresa.nombre : 'Sin Empresa (Global)',
            createdAt: u.createdAt,
            roles: u.Rols ? u.Rols.map(r => r.nombre) : [],
            rolId: u.Rols && u.Rols.length > 0 ? u.Rols[0].id : null,
            emisores: u.Emisors ? u.Emisors.map(e => ({ id: e.id, rfc: e.rfc, razon_social: e.razon_social })) : []
        }));

        res.json(result);
    } catch (error) {
        console.error('Error fetching usuarios:', error);
        res.status(500).json({ message: 'Error al obtener usuarios' });
    }
};

// Crear nuevo usuario
export const createUsuario = async (req, res) => {
    const { nombre, email, password, rolId, emisoresIds, activo, empresaId } = req.body;

    try {
        // Validar que el rol exista
        const targetRol = await Rol.findByPk(rolId);
        if (!targetRol) {
            return res.status(400).json({ message: 'El rol especificado no existe.' });
        }

        let finalEmpresaId = null;

        if (req.usuario.rol === 'Usuario Empresarial') {
            // No puede crear administradores
            if (targetRol.nombre === 'Administrador') {
                return res.status(403).json({ message: 'No tienes permisos para crear usuarios administradores.' });
            }

            // Su empresa se sobreescribe con la del creador
            finalEmpresaId = req.usuario.empresa_id;

            // Validar que los emisores asignados pertenezcan a la misma empresa
            if (emisoresIds && emisoresIds.length > 0) {
                const queryEmisores = await Emisor.findAll({ where: { id: emisoresIds } });
                const todosMios = queryEmisores.every(e => e.empresa_id === finalEmpresaId);
                if (!todosMios) {
                    return res.status(403).json({ message: 'Solo puedes asignar emisores pertenecientes a tu empresa.' });
                }
            }
        } else if (req.usuario.rol === 'Administrador') {
            // El admin global puede seleccionar la empresa para el usuario
            finalEmpresaId = empresaId ? Number(empresaId) : null;
        } else {
            return res.status(403).json({ message: 'No tienes permisos para crear usuarios.' });
        }

        // Verificar si el correo ya existe
        const existing = await Usuario.findOne({ where: { email } });
        if (existing) {
            return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
        }

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Crear el usuario
        const nuevoUsuario = await Usuario.create({
            nombre,
            email,
            password_hash,
            activo: activo !== undefined ? activo : true,
            empresa_id: finalEmpresaId
        });

        // Asignar rol
        await nuevoUsuario.addRol(targetRol);

        // Asignar emisores
        if (emisoresIds && emisoresIds.length > 0) {
            const emisores = await Emisor.findAll({ where: { id: emisoresIds } });
            await nuevoUsuario.setEmisors(emisores);
        }

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            usuario: {
                id: nuevoUsuario.id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                activo: nuevoUsuario.activo,
                empresa_id: nuevoUsuario.empresa_id
            }
        });
    } catch (error) {
        console.error('Error creating usuario:', error);
        res.status(500).json({ message: 'Error al crear usuario.' });
    }
};

// Actualizar usuario
export const updateUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, password, rolId, emisoresIds, activo, empresaId } = req.body;

    try {
        const targetUsuario = await Usuario.findByPk(id, {
            include: [Rol, Emisor]
        });

        if (!targetUsuario) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const esMismoUsuario = Number(id) === req.usuario.id;

        if (req.usuario.rol === 'Usuario Empresarial') {
            // No puede editar a un Administrador
            const esAdmin = targetUsuario.Rols && targetUsuario.Rols.some(r => r.nombre === 'Administrador');
            if (esAdmin) {
                return res.status(403).json({ message: 'No tienes permisos para modificar a un administrador.' });
            }

            // Validar que pertenezca a la misma empresa
            if (targetUsuario.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para modificar usuarios de otras empresas.' });
            }

            // Validar que los nuevos emisores pertenezcan a la empresa
            if (emisoresIds) {
                const queryEmisores = await Emisor.findAll({ where: { id: emisoresIds } });
                const todosMios = queryEmisores.every(e => e.empresa_id === req.usuario.empresa_id);
                if (!todosMios) {
                    return res.status(403).json({ message: 'Solo puedes asignar emisores de tu misma empresa.' });
                }
            }

            // No puede cambiar el rol a Administrador
            if (rolId) {
                const targetRol = await Rol.findByPk(rolId);
                if (targetRol && targetRol.nombre === 'Administrador') {
                    return res.status(403).json({ message: 'No puedes asignar el rol de Administrador.' });
                }
            }
        } else if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'No tienes permisos para modificar usuarios.' });
        }

        // Validar correo duplicado
        if (email && email !== targetUsuario.email) {
            const existing = await Usuario.findOne({ where: { email } });
            if (existing) {
                return res.status(400).json({ message: 'El correo electrónico ya está registrado por otro usuario.' });
            }
            targetUsuario.email = email;
        }

        // Actualizar datos básicos
        if (nombre) targetUsuario.nombre = nombre;
        if (activo !== undefined) targetUsuario.activo = activo;

        // Actualizar empresa si es Administrador
        if (req.usuario.rol === 'Administrador' && empresaId !== undefined) {
            targetUsuario.empresa_id = empresaId ? Number(empresaId) : null;
        }

        // Actualizar contraseña si se envió
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            targetUsuario.password_hash = await bcrypt.hash(password, salt);
        }

        await targetUsuario.save();

        // Actualizar rol (solo si no es el mismo usuario intentando cambiar su propio rol)
        if (rolId && !esMismoUsuario) {
            const rol = await Rol.findByPk(rolId);
            if (rol) {
                await targetUsuario.setRols([rol]);
            }
        }

        // Actualizar emisores
        if (emisoresIds) {
            const emisores = await Emisor.findAll({ where: { id: emisoresIds } });
            await targetUsuario.setEmisors(emisores);
        }

        res.json({ message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        console.error('Error updating usuario:', error);
        res.status(500).json({ message: 'Error al actualizar usuario.' });
    }
};

// Eliminar usuario
export const deleteUsuario = async (req, res) => {
    const { id } = req.params;

    try {
        const targetUsuario = await Usuario.findByPk(id, {
            include: [Rol]
        });

        if (!targetUsuario) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // No se puede eliminar a sí mismo
        if (Number(id) === req.usuario.id) {
            return res.status(400).json({ message: 'No puedes eliminar tu propio usuario.' });
        }

        if (req.usuario.rol === 'Usuario Empresarial') {
            // No puede eliminar a un Administrador
            const esAdmin = targetUsuario.Rols && targetUsuario.Rols.some(r => r.nombre === 'Administrador');
            if (esAdmin) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar a un administrador.' });
            }

            // Validar que pertenezca a la misma empresa
            if (targetUsuario.empresa_id !== req.usuario.empresa_id) {
                return res.status(403).json({ message: 'No tienes permisos para eliminar este usuario.' });
            }
        } else if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'No tienes permisos para eliminar usuarios.' });
        }

        // Eliminar relaciones explícitamente para evitar problemas de constraint
        await targetUsuario.setRols([]);
        await targetUsuario.setEmisors([]);

        await targetUsuario.destroy();
        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting usuario:', error);
        res.status(500).json({ message: 'Error al eliminar usuario.' });
    }
};

// Obtener roles disponibles para asignación
export const getRoles = async (req, res) => {
    try {
        let roles = await Rol.findAll();
        
        // Un Usuario Empresarial no puede asignar ni ver el rol Administrador
        if (req.usuario.rol === 'Usuario Empresarial') {
            roles = roles.filter(r => r.nombre !== 'Administrador');
        }

        res.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Error al obtener roles' });
    }
};

// Obtener lista de empresas (solo para administradores)
export const getEmpresas = async (req, res) => {
    try {
        if (req.usuario.rol !== 'Administrador') {
            return res.status(403).json({ message: 'Acceso denegado.' });
        }
        const empresas = await Empresa.findAll({ order: [['nombre', 'ASC']] });
        res.json(empresas);
    } catch (error) {
        console.error('Error fetching empresas:', error);
        res.status(500).json({ message: 'Error al obtener empresas' });
    }
};
