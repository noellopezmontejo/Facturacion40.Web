import { Router } from 'express';
import { getImpuestos, createImpuesto, updateImpuesto, deleteImpuesto } from '../controllers/impuestoController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.get('/', getImpuestos);
router.post('/', createImpuesto);
router.put('/:id', updateImpuesto);
router.delete('/:id', deleteImpuesto);

export default router;
