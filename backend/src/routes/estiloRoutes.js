import { Router } from 'express';
import { getEstilo, updateEstilo } from '../controllers/estiloController.js';
import { verifyToken } from '../middleware/auth.js';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

router.get('/:emisorId', getEstilo);
router.put('/:emisorId', upload.single('logo'), updateEstilo);

export default router;
