import { Router } from 'express';
import { getPagos, getFacturasPendientes, registrarPago, emitirREP, getCartera, previewPagoPDF } from '../controllers/pagoController.js';
import { verifyToken, checkEmisorPermission } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(checkEmisorPermission);

router.get('/', getPagos);
router.get('/cartera', getCartera);
router.get('/pendientes', getFacturasPendientes);
router.post('/registrar', registrarPago);
router.post('/preview-pdf', previewPagoPDF);
router.post('/:id/emitir', emitirREP);

export default router;
