import { Router } from 'express';
import { 
    getRecurrentes, 
    getRecurrenteById, 
    createRecurrente, 
    updateRecurrente, 
    updateRecurrenteEstado, 
    ejecutarRecurrenteManual, 
    deleteRecurrente,
    getRecurrentesStats,
    procesarPendientesBatch
} from '../controllers/recurrenteController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);

router.get('/stats', getRecurrentesStats);
router.post('/procesar-pendientes', procesarPendientesBatch);
router.get('/', getRecurrentes);
router.get('/:id', getRecurrenteById);
router.post('/', createRecurrente);
router.put('/:id', updateRecurrente);
router.patch('/:id/estado', updateRecurrenteEstado);
router.post('/:id/ejecutar', ejecutarRecurrenteManual);
router.delete('/:id', deleteRecurrente);

export default router;
