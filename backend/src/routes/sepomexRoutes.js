import { Router } from 'express';
import { getByCodigoPostal } from '../controllers/sepomexController.js';

const router = Router();

// Endpoint público o protegido según se requiera. Lo dejamos público para facilitar llenado
router.get('/cp/:cp', getByCodigoPostal);

export default router;
