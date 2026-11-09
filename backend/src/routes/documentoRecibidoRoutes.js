import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { 
    importarXMLs, 
    getDocumentosRecibidos, 
    getResumenCuentasPorPagar, 
    solicitarDescargaSAT,
    getSolicitudesDescarga,
    verificarSolicitudSAT,
    descargarEImportarPaquetesSAT,
    simularPaquetesPrueba
} from '../controllers/documentoRecibidoController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Proteger todas las rutas con JWT token
router.use(verifyToken);

router.post('/importar', upload.array('files'), importarXMLs);
router.get('/', getDocumentosRecibidos);
router.get('/resumen', getResumenCuentasPorPagar);
router.post('/solicitar-descarga', upload.fields([{ name: 'fiel_cer', maxCount: 1 }, { name: 'fiel_key', maxCount: 1 }]), solicitarDescargaSAT);
router.get('/solicitudes', getSolicitudesDescarga);
router.post('/verificar-solicitud/:id', verificarSolicitudSAT);
router.post('/descargar-paquetes/:id', descargarEImportarPaquetesSAT);
router.post('/simular-paquetes/:id', simularPaquetesPrueba);

export default router;
