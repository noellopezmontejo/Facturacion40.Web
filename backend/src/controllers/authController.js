import { Usuario, Rol } from '../models/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Por favor, ingresa tu correo y contraseña.' });
        }

        const usuario = await Usuario.findOne({
            where: { email },
            include: [{ model: Rol, attributes: ['nombre'] }]
        });

        if (!usuario || !usuario.activo) {
            return res.status(401).json({ message: 'Credenciales inválidas o usuario inactivo.' });
        }

        const isMatch = await bcrypt.compare(password, usuario.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const rolNombre = usuario.Rols && usuario.Rols.length > 0 ? usuario.Rols[0].nombre : 'Operador';

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, rol: rolNombre, empresa_id: usuario.empresa_id },
            process.env.JWT_SECRET || 'super_secret_jwt_key_cfdi40',
            { expiresIn: '1d' }
        );

        res.json({
            message: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                rol: rolNombre,
                empresa_id: usuario.empresa_id
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

export const register = async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        const existingUser = await Usuario.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'El correo ya está registrado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const nuevoUsuario = await Usuario.create({
            nombre,
            email,
            password_hash
        });

        // Asignar rol por defecto (ej. Operador)
        let rolOperador = await Rol.findOne({ where: { nombre: 'Operador' } });
        if (rolOperador) {
            await nuevoUsuario.addRol(rolOperador);
        }

        res.status(201).json({ message: 'Usuario registrado exitosamente', usuarioId: nuevoUsuario.id });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ message: 'Error interno del servidor al registrar.' });
    }
};
