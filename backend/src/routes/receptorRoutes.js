import { Router } from 'express';
import { getReceptoresByEmisor, createReceptor, updateReceptor, deleteReceptor } from '../controllers/receptorController.js';
import { verifyToken, checkEmisorPermission } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(checkEmisorPermission);

router.get('/emisor/:emisorId', getReceptoresByEmisor);
router.post('/', createReceptor);
router.put('/:id', updateReceptor);
router.delete('/:id', deleteReceptor);

export default router;
