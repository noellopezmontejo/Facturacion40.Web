import express from 'express';
import { 
    getImpuestosLocales, 
    createImpuestoLocal, 
    updateImpuestoLocal, 
    deleteImpuestoLocal 
} from '../controllers/impuestoLocalController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getImpuestosLocales);
router.post('/', createImpuestoLocal);
router.put('/:id', updateImpuestoLocal);
router.delete('/:id', deleteImpuestoLocal);

export default router;
