import { Router } from 'express';
import { getCotizaciones, getCotizacionById, createCotizacion, updateCotizacionStatus, getCotizacionPdf } from '../controllers/cotizacionController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', getCotizaciones);
router.get('/:id', getCotizacionById);
router.get('/:id/pdf', getCotizacionPdf);
router.post('/', createCotizacion);
router.put('/:id/estado', updateCotizacionStatus);

export default router;
