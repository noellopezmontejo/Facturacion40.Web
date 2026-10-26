import { Router } from 'express';
import { 
    getResumenCuentaIntegrador, 
    getHistorialFolios, 
    asignarFoliosAEmisor, 
    testConexionGlobal, 
    consultarStatusSatGlobal, 
    consultarPeticionesPendientesGlobal 
} from '../controllers/pacController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de administración global del PAC requieren autenticación
router.use(verifyToken);

// Operaciones reservadas para administradores y usuarios con gestión empresarial
router.get('/resumen-integrador', requireRole(['Administrador']), getResumenCuentaIntegrador);
router.get('/historial-folios', getHistorialFolios);
router.post('/asignar-folios', requireRole(['Administrador']), asignarFoliosAEmisor);
router.get('/test-conexion', testConexionGlobal);
router.post('/consulta-sat', consultarStatusSatGlobal);
router.get('/peticiones-pendientes/:emisor_id', consultarPeticionesPendientesGlobal);

export default router;
