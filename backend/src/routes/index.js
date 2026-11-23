
import { Router } from 'express';

import authRoutes from './authRoutes.js';
import declarationRoutes from './declarationRoutes.js';
import userRoutes from './userRoutes.js';
import matchRouter from './matchRoutes.js';
import declarationMatchRouter from './declarationMatchRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/matches', matchRouter);
router.use('/declarations', declarationMatchRouter);
router.use('/declarations', declarationRoutes);
router.use('/users', userRoutes);

export default router;
