import { Router } from 'express';
import {
    getFormasPago,
    getMetodosPago,
    getRegimenesFiscales,
    getUsosCfdi,
    getTiposDocumento
} from '../controllers/catalogosController.js';

const router = Router();

router.get('/formas-pago', getFormasPago);
router.get('/metodos-pago', getMetodosPago);
router.get('/regimenes-fiscales', getRegimenesFiscales);
router.get('/usos-cfdi', getUsosCfdi);
router.get('/tipos-documento', getTiposDocumento);

export default router;
