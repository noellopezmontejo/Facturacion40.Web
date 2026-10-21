import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { 
    importarXMLs, 
    getDocumentosRecibidos, 
    getResumenCuentasPorPagar, 
    solicitarDescargaSAT 
} from '../controllers/documentoRecibidoController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Proteger todas las rutas con JWT token
router.use(verifyToken);

router.post('/importar', upload.array('files'), importarXMLs);
router.get('/', getDocumentosRecibidos);
router.get('/resumen', getResumenCuentasPorPagar);
router.post('/solicitar-descarga', solicitarDescargaSAT);

export default router;
