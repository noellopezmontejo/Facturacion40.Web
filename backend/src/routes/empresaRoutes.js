import { Router } from 'express';
import { getMiEmpresa, updateMiEmpresa, createEmpresa, getEmpresas } from '../controllers/empresaController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
// Solo Administradores y Usuarios Empresariales pueden gestionar la configuración del espacio
router.use(requireRole(['Administrador', 'Usuario Empresarial']));

router.get('/', requireRole(['Administrador']), getEmpresas);
router.get('/mi-empresa', getMiEmpresa);
router.put('/mi-empresa', updateMiEmpresa);
router.post('/', requireRole(['Administrador']), createEmpresa);

export default router;

