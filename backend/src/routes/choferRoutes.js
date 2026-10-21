import express from 'express';
import { getChoferes, createChofer, updateChofer, deleteChofer } from '../controllers/choferController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getChoferes);
router.post('/', createChofer);
router.put('/:id', updateChofer);
router.delete('/:id', deleteChofer);

export default router;
