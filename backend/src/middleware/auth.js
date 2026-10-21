import jwt from 'jsonwebtoken';
import { Usuario, Emisor } from '../models/index.js';

export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'No se proporcionó un token de autenticación.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_cfdi40');
        
        // Normalizar nombres de roles antiguos para compatibilidad con sesiones activas
        if (decoded.rol === 'Super Administrador') {
            decoded.rol = 'Administrador';
        } else if (decoded.rol === 'Administrador de Empresa') {
            decoded.rol = 'Usuario Empresarial';
        }

        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado.', error: error.message });
    }
};

export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' });
        }
        next();
    };
};

export const checkEmisorPermission = async (req, res, next) => {
    // Si es Administrador, tiene acceso completo a todos los emisores
    if (!req.usuario) {
        return res.status(401).json({ message: 'No autenticado.' });
    }
    
    if (req.usuario.rol === 'Administrador') {
        return next();
    }

    // Extraer emisorId de cualquier parte de la petición
    let emisorId = req.params.emisorId || req.query.emisorId || req.query.emisor_id || req.body.emisor_id || req.body.emisorId;

    if (!emisorId && req.params.id && (req.baseUrl.includes('emisores') || req.path.includes('emisores'))) {
        emisorId = req.params.id;
    }

    if (!emisorId) {
        return next();
    }

    try {
        const emisor = await Emisor.findByPk(emisorId);
        if (!emisor) {
            return res.status(404).json({ message: 'Emisor no encontrado.' });
        }

        // Si no pertenece a la misma empresa, denegar
        if (emisor.empresa_id !== req.usuario.empresa_id) {
            return res.status(403).json({ message: 'No tienes permisos de acceso en este entorno empresarial.' });
        }
        next();
    } catch (err) {
        console.error('Error al validar permisos de emisor:', err);
        return res.status(500).json({ message: 'Error interno de servidor al validar entorno empresarial.' });
    }
};
