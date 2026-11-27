import jwt from 'jsonwebtoken';
import { Usuario, Emisor } from '../models/index.js';

export const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
        console.warn('[Security] ADVERTENCIA: JWT_SECRET no está definido en variables de entorno.');
    }
    return secret || 'super_secret_jwt_key_cfdi40';
};

// Rate Limiter ligero en memoria por IP y ruta (sin dependencias externas)
const rateBuckets = new Map();

export const createRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 15, message = 'Demasiados intentos. Por favor espera unos minutos.' } = {}) => {
    return (req, res, next) => {
        const now = Date.now();
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip) || 'unknown';
        const key = `${req.baseUrl}${req.path}:${ip}`;

        let entry = rateBuckets.get(key);
        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
        }
        entry.count += 1;
        rateBuckets.set(key, entry);

        // Limpieza periódica de entradas expiradas
        if (rateBuckets.size > 2000) {
            for (const [k, v] of rateBuckets.entries()) {
                if (now > v.resetAt) rateBuckets.delete(k);
            }
        }

        if (entry.count > max) {
            const retrySec = Math.ceil((entry.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retrySec));
            return res.status(429).json({ message });
        }
        next();
    };
};

// Caché breve (30s) de estado activo de usuarios para invalidar sesiones de cuentas suspendidas
const userStatusCache = new Map();

export const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'No se proporcionó un token de autenticación.' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());

        // Normalizar nombres de roles antiguos para compatibilidad con sesiones activas
        if (decoded.rol === 'Super Administrador') {
            decoded.rol = 'Administrador';
        } else if (decoded.rol === 'Administrador de Empresa') {
            decoded.rol = 'Usuario Empresarial';
        }

        // Verificar que el usuario siga activo y sincronizar su empresa_id real (con caché de 30s)
        if (decoded.id) {
            const now = Date.now();
            const cached = userStatusCache.get(decoded.id);
            if (cached && now < cached.expiresAt) {
                if (!cached.activo) {
                    return res.status(401).json({ message: 'Tu cuenta ha sido desactivada.' });
                }
                decoded.empresa_id = cached.empresa_id;
            } else {
                const dbUser = await Usuario.findByPk(decoded.id, { attributes: ['id', 'activo', 'empresa_id'] });
                if (!dbUser || !dbUser.activo) {
                    userStatusCache.set(decoded.id, { activo: false, empresa_id: null, expiresAt: now + 30000 });
                    return res.status(401).json({ message: 'Usuario inactivo o no encontrado.' });
                }
                decoded.empresa_id = dbUser.empresa_id;
                userStatusCache.set(decoded.id, { activo: true, empresa_id: dbUser.empresa_id, expiresAt: now + 30000 });
            }
        }

        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado.' });
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

/**
 * Devuelve la lista de IDs de Emisor a los que tiene acceso el usuario en sesión.
 * Si es Administrador global, devuelve null (acceso a todos) o filtra por requestedEmisorId si se indicó.
 */
export const getAuthorizedEmisorIds = async (req, requestedEmisorId = null) => {
    if (!req.usuario) return [];

    if (req.usuario.rol === 'Administrador') {
        if (requestedEmisorId) return [Number(requestedEmisorId)];
        return null; // null = sin restricción de empresa para el Administrador global
    }

    if (!req.usuario.empresa_id) {
        return [];
    }

    const emisores = await Emisor.findAll({
        where: { empresa_id: req.usuario.empresa_id },
        attributes: ['id']
    });
    const allowedIds = emisores.map(e => Number(e.id));

    if (requestedEmisorId) {
        const reqNum = Number(requestedEmisorId);
        return allowedIds.includes(reqNum) ? [reqNum] : [];
    }

    return allowedIds;
};

/**
 * Verifica si el usuario actual tiene permiso para operar sobre un emisorId específico.
 */
export const canAccessEmisorId = async (req, emisorId) => {
    if (!req.usuario) return false;
    if (req.usuario.rol === 'Administrador') return true;
    if (!emisorId || !req.usuario.empresa_id) return false;

    const emisor = await Emisor.findByPk(emisorId, { attributes: ['id', 'empresa_id'] });
    if (!emisor) return false;
    return Number(emisor.empresa_id) === Number(req.usuario.empresa_id);
};

export const checkEmisorPermission = async (req, res, next) => {
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

        if (Number(emisor.empresa_id) !== Number(req.usuario.empresa_id)) {
            return res.status(403).json({ message: 'No tienes permisos de acceso en este entorno empresarial.' });
        }
        next();
    } catch (err) {
        console.error('Error al validar permisos de emisor:', err);
        return res.status(500).json({ message: 'Error interno de servidor al validar entorno empresarial.' });
    }
};
