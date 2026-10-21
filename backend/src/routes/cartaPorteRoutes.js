import express from 'express';
import { emitirCartaPorte } from '../controllers/cartaPorteController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.post('/emitir', emitirCartaPorte);

export default router;
