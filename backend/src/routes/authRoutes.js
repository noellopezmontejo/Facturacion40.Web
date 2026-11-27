import { Router } from 'express';
import { 
    login, 
    register, 
    solicitarRecuperacionPassword, 
    verificarTokenReset, 
    restablecerPassword 
} from '../controllers/authController.js';
import { verifyToken, requireRole, createRateLimiter } from '../middleware/auth.js';

const router = Router();

const loginRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Demasiados intentos de inicio de sesión. Por seguridad, espera 15 minutos antes de intentar de nuevo.'
});

const resetPasswordRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 6,
    message: 'Se alcanzó el límite de solicitudes de recuperación de contraseña. Intenta nuevamente más tarde.'
});

router.post('/login', loginRateLimiter, login);

// Registro restringido exclusivamente a Administradores autenticados
router.post('/register', verifyToken, requireRole(['Administrador']), register);

// Recuperación de Contraseña protegida con Rate Limiting
router.post('/recuperar-password', resetPasswordRateLimiter, solicitarRecuperacionPassword);
router.get('/verificar-token-reset', verificarTokenReset);
router.post('/restablecer-password', resetPasswordRateLimiter, restablecerPassword);

// Sesión actual
router.get('/me', verifyToken, (req, res) => {
    res.json({ usuario: req.usuario });
});

export default router;
