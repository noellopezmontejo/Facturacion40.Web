import { Router } from 'express';
import { getDashboardData } from '../controllers/dashboardController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

router.use(verifyToken);
router.get('/', getDashboardData);

export default router;
