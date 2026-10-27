import { Router } from 'express';
import { 
    getResumenCuentaIntegrador, 
    getHistorialFolios, 
    asignarFoliosAEmisor, 
    testConexionGlobal, 
    consultarStatusSatGlobal, 
    consultarPeticionesPendientesGlobal,
    getCredencialesPAC,
    guardarCredencialesPAC
} from '../controllers/pacController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de administración global del PAC requieren autenticación y rol exclusivo de Administrador / Superusuario
router.use(verifyToken);
router.use(requireRole(['Administrador']));

// Operaciones reservadas exclusivamente para el superusuario / administrador del sistema
router.get('/resumen-integrador', getResumenCuentaIntegrador);
router.get('/credenciales', getCredencialesPAC);
router.post('/credenciales', guardarCredencialesPAC);
router.get('/historial-folios', getHistorialFolios);
router.post('/asignar-folios', asignarFoliosAEmisor);
router.get('/test-conexion', testConexionGlobal);
router.post('/consulta-sat', consultarStatusSatGlobal);
router.get('/peticiones-pendientes/:emisor_id', consultarPeticionesPendientesGlobal);

export default router;
