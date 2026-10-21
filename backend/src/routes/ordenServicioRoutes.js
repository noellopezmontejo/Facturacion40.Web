import { Router } from 'express';
import { getOrdenesServicio, getOrdenServicioById, createOrdenServicio, updateOrdenServicioStatus, addDetallesOrdenServicio } from '../controllers/ordenServicioController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/', getOrdenesServicio);
router.get('/:id', getOrdenServicioById);
router.post('/', createOrdenServicio);
router.put('/:id/estado', updateOrdenServicioStatus);
router.post('/:id/detalles', addDetallesOrdenServicio);

export default router;
