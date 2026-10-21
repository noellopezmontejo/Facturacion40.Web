import { Router } from 'express';
import { getUsuarios, createUsuario, updateUsuario, deleteUsuario, getRoles, getEmpresas } from '../controllers/usuarioController.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Todas las rutas requieren token de autenticación
router.use(verifyToken);

// Solo Administradores y Usuarios Empresariales pueden gestionar usuarios
router.use(requireRole(['Administrador', 'Usuario Empresarial']));

router.get('/', getUsuarios);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.delete('/:id', deleteUsuario);
router.get('/roles', getRoles);
router.get('/empresas', getEmpresas);

export default router;
