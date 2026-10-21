import { Router } from 'express';
import { getConceptosByEmisor, createConcepto, updateConcepto, deleteConcepto } from '../controllers/conceptoController.js';
import { verifyToken, checkEmisorPermission } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(checkEmisorPermission);

router.get('/emisor/:emisorId', getConceptosByEmisor);
router.post('/', createConcepto);
router.put('/:id', updateConcepto);
router.delete('/:id', deleteConcepto);

export default router;
