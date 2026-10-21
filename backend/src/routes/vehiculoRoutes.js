import express from 'express';
import { getVehiculos, createVehiculo, updateVehiculo, deleteVehiculo } from '../controllers/vehiculoController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getVehiculos);
router.post('/', createVehiculo);
router.put('/:id', updateVehiculo);
router.delete('/:id', deleteVehiculo);

export default router;
