import { Usuario, Rol } from '../models/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { enviarCorreoRecuperacionPassword } from '../services/emailService.js';

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
        res.status(500).json({ 
            message: 'Error interno del servidor al procesar inicio de sesión.',
            detail: error.message,
            code: error.original?.code || error.code
        });
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

/**
 * Solicita el restablecimiento de contraseña y envía el correo con el enlace
 */
export const solicitarRecuperacionPassword = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Por favor, proporciona un correo electrónico válido.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const usuario = await Usuario.findOne({ where: { email: cleanEmail } });

        if (!usuario) {
            return res.json({
                success: true,
                message: 'Si el correo electrónico está registrado en la plataforma, recibirás un enlace de recuperación en breve.'
            });
        }

        if (!usuario.activo) {
            return res.status(400).json({ message: 'Esta cuenta de usuario se encuentra inactiva o suspendida.' });
        }

        // Generar token criptográfico único
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 3600000); // 1 hora de vigencia

        usuario.reset_password_token = resetToken;
        usuario.reset_password_expires = tokenExpires;
        await usuario.save();

        // Determinar URL base de la aplicación web
        let baseUrl = process.env.FRONTEND_URL;
        if (!baseUrl) {
            const origin = req.headers.origin || req.headers.referer;
            if (origin) {
                try {
                    const u = new URL(origin);
                    baseUrl = `${u.protocol}//${u.host}`;
                } catch (e) {
                    baseUrl = null;
                }
            }
        }
        if (!baseUrl) {
            baseUrl = 'https://facturacion40.netconsultores.com.mx';
        }

        const resetUrl = `${baseUrl.replace(/\/+$/, '')}/restablecer-password?token=${resetToken}`;

        await enviarCorreoRecuperacionPassword(usuario, resetUrl);

        res.json({
            success: true,
            message: 'Hemos enviado un correo electrónico con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.'
        });
    } catch (error) {
        console.error('Error al solicitar recuperación de contraseña:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al procesar la solicitud de recuperación de contraseña.'
        });
    }
};

/**
 * Valida si un token de recuperación existe y sigue vigente
 */
export const verificarTokenReset = async (req, res) => {
    const { token } = req.query;
    try {
        if (!token) {
            return res.status(400).json({ valid: false, message: 'Token de recuperación no proporcionado.' });
        }

        const usuario = await Usuario.findOne({
            where: {
                reset_password_token: token,
                reset_password_expires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!usuario) {
            return res.status(400).json({
                valid: false,
                message: 'El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.'
            });
        }

        res.json({
            valid: true,
            nombre: usuario.nombre,
            email: usuario.email
        });
    } catch (error) {
        console.error('Error verificando token de recuperación:', error);
        res.status(500).json({ valid: false, message: 'Error interno al verificar el token.' });
    }
};

/**
 * Aplica la nueva contraseña en base a un token válido
 */
export const restablecerPassword = async (req, res) => {
    const { token, password } = req.body;
    try {
        if (!token) {
            return res.status(400).json({ message: 'Token de recuperación requerido.' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        }

        const usuario = await Usuario.findOne({
            where: {
                reset_password_token: token,
                reset_password_expires: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!usuario) {
            return res.status(400).json({
                message: 'El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        usuario.password_hash = await bcrypt.hash(password, salt);
        usuario.reset_password_token = null;
        usuario.reset_password_expires = null;
        await usuario.save();

        res.json({
            success: true,
            message: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.'
        });
    } catch (error) {
        console.error('Error al restablecer contraseña:', error);
        res.status(500).json({ message: 'Error interno al restablecer la contraseña.' });
    }
};
