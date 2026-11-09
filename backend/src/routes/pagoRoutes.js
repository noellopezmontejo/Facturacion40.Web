import { Router } from 'express';
import { 
    getPagos, 
    getFacturasPendientes, 
    registrarPago, 
    emitirREP, 
    getCartera, 
    previewPagoPDF, 
    cancelarPago,
    solicitarDescargaEmitidosSAT,
    getSolicitudesEmitidosSAT,
    verificarSolicitudEmitidosSAT,
    descargarEImportarEmitidosSAT,
    importarXmlsEmitidosManual
} from '../controllers/pagoController.js';
import { verifyToken, checkEmisorPermission } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.use(verifyToken);
router.use(checkEmisorPermission);

router.get('/', getPagos);
router.get('/cartera', getCartera);
router.get('/pendientes', getFacturasPendientes);
router.post('/registrar', registrarPago);
router.post('/preview-pdf', previewPagoPDF);
router.post('/:id/emitir', emitirREP);
router.post('/:id/cancelar', cancelarPago);

// Operaciones SAT Descarga Masiva de Facturas Emitidas (Cuentas por Cobrar)
router.post('/solicitar-descarga-sat', solicitarDescargaEmitidosSAT);
router.get('/solicitudes-sat', getSolicitudesEmitidosSAT);
router.post('/verificar-solicitud-sat/:id', verificarSolicitudEmitidosSAT);
router.post('/descargar-paquetes-sat/:id', descargarEImportarEmitidosSAT);
router.post('/importar-xmls', upload.array('archivos_xml', 100), importarXmlsEmitidosManual);

export default router;
