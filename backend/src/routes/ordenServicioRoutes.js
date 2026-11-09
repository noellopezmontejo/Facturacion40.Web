import { Router } from 'express';
import multer from 'multer';
import { 
    getOrdenesServicio, 
    getOrdenServicioById, 
    createOrdenServicio, 
    updateOrdenServicioStatus, 
    updateOrdenServicio,
    addDetallesOrdenServicio,
    getOrdenServicioPdf,
    uploadEvidenciasOrdenServicio,
    deleteEvidenciaOrdenServicio
} from '../controllers/ordenServicioController.js';
import { verifyToken } from '../middleware/auth.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB para videos/imágenes
});

const router = Router();

router.use(verifyToken);

router.get('/', getOrdenesServicio);
router.get('/:id', getOrdenServicioById);
router.get('/:id/pdf', getOrdenServicioPdf);
router.post('/', createOrdenServicio);
router.put('/:id', updateOrdenServicio);
router.put('/:id/estado', updateOrdenServicioStatus);
router.post('/:id/detalles', addDetallesOrdenServicio);
router.post('/:id/evidencias', upload.array('archivos', 10), uploadEvidenciasOrdenServicio);
router.delete('/:id/evidencias/:evidenciaId', deleteEvidenciaOrdenServicio);

export default router;
