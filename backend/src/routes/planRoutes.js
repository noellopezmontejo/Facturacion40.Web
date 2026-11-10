import { Router } from 'express';
import { 
    getPlanes, 
    updatePlanesGlobales, 
    getSuscripcionEmpresa, 
    updateSuscripcionEmpresa 
} from '../controllers/planController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// Rutas de planes globales
router.get('/', verifyToken, getPlanes);
router.put('/actualizar-todos', verifyToken, updatePlanesGlobales);

// Rutas de suscripción por empresa
router.get('/empresa/:id', verifyToken, getSuscripcionEmpresa);
router.put('/empresa/:id', verifyToken, updateSuscripcionEmpresa);

export default router;
