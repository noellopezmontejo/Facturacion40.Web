import { Router } from 'express';
import { 
    login, 
    register, 
    solicitarRecuperacionPassword, 
    verificarTokenReset, 
    restablecerPassword 
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', register);

// Recuperación de Contraseña
router.post('/recuperar-password', solicitarRecuperacionPassword);
router.get('/verificar-token-reset', verificarTokenReset);
router.post('/restablecer-password', restablecerPassword);

// Ejemplo de ruta protegida
router.get('/me', verifyToken, (req, res) => {
    res.json({ usuario: req.usuario });
});

export default router;
