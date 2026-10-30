import { Router } from 'express';
import demoRoutes from '../errors/demo/demo.routes.js';

const router = Router();

router.use('/demo', demoRoutes);

export default router;
