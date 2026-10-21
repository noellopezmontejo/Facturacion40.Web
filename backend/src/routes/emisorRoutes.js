import { Router } from 'express';
import { getEmisores, createEmisor, updateEmisor, deleteEmisor, uploadCSD, upload, getSeries, getPreviewPDF, upsertSerie, deleteSerie, getCreditos, getEmisorTotalAnual } from '../controllers/emisorController.js';
import { verifyToken, checkEmisorPermission } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de emisores quedan protegidas
router.use(verifyToken);
router.use(checkEmisorPermission);

router.get('/', getEmisores);
router.post('/', createEmisor);
router.put('/:id', updateEmisor);
router.put('/:id/csd', upload.fields([
    { name: 'certificado', maxCount: 1 },
    { name: 'llave_privada', maxCount: 1 }
]), uploadCSD);
router.delete('/:id', deleteEmisor);
router.get('/:id/series', getSeries);
router.post('/:id/series', upsertSerie);
router.delete('/:id/series/:serieId', deleteSerie);
router.post('/:id/preview-pdf', getPreviewPDF);
router.get('/:id/creditos', getCreditos);
router.get('/:id/total-anual', getEmisorTotalAnual);

export default router;
