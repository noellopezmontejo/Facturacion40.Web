import { Router } from 'express';
import { login, register } from '../controllers/authController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/register', register); // En producción, el registro puede estar restringido al Super Admin

// Ejemplo de ruta protegida
router.get('/me', verifyToken, (req, res) => {
    res.json({ usuario: req.usuario });
});

export default router;
