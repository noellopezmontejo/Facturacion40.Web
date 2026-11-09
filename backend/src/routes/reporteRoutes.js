import { Router } from 'express';
import { getReporteCompleto } from '../controllers/reporteController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/completo', getReporteCompleto);

export default router;

