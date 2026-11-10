import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
    getPlanes, 
    updatePlanesGlobales, 
    getSuscripcionEmpresa, 
    updateSuscripcionEmpresa,
    getMiSuscripcion,
    reportarPagoTransferencia,
    crearPreferenciaMercadoPago,
    webhookMercadoPago,
    getComprobantesPendientes,
    aprobarPagoSuscripcion,
    rechazarPagoSuscripcion
} from '../controllers/planController.js';
import { verifyToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../storage/comprobantes');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, storageDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const unique = `comp-${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`;
        cb(null, unique);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP) o documentos PDF.'));
    }
});

const router = Router();

// Rutas de planes globales
router.get('/', verifyToken, getPlanes);
router.put('/actualizar-todos', verifyToken, updatePlanesGlobales);

// Rutas de cliente (Suscripción propia y pagos)
router.get('/mi-suscripcion', verifyToken, getMiSuscripcion);
router.post('/reportar-transferencia', verifyToken, upload.single('comprobante'), reportarPagoTransferencia);
router.post('/crear-preferencia-mp', verifyToken, crearPreferenciaMercadoPago);
router.post('/webhook-mp', webhookMercadoPago);

// Rutas de administración de comprobantes y transferencias
router.get('/comprobantes-pendientes', verifyToken, getComprobantesPendientes);
router.post('/aprobar-pago/:id', verifyToken, aprobarPagoSuscripcion);
router.post('/rechazar-pago/:id', verifyToken, rechazarPagoSuscripcion);

// Rutas de suscripción por empresa (Admin)
router.get('/empresa/:id', verifyToken, getSuscripcionEmpresa);
router.put('/empresa/:id', verifyToken, updateSuscripcionEmpresa);

export default router;
