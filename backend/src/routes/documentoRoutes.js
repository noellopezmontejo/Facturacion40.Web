import { Router } from 'express';
import { getDocumentos, emitirFactura, timbrarDocumento, previewDocumento, reproducirPDF, enviarDocumentoPorCorreo, descargarXML, verificarPreCancelacion, cancelarDocumento } from '../controllers/documentoController.js';
import { verifyToken, checkEmisorPermission } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.use(checkEmisorPermission);

router.get('/', getDocumentos);
router.post('/emitir', emitirFactura);
router.post('/preview', previewDocumento);
router.post('/:id/timbrar', timbrarDocumento);
router.get('/:id/pdf', reproducirPDF);
router.get('/:id/xml', descargarXML);
router.post('/:id/enviar-correo', enviarDocumentoPorCorreo);
router.get('/:id/pre-cancelacion', verificarPreCancelacion);
router.post('/:id/cancelar', cancelarDocumento);

export default router;
