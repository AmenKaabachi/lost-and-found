import { Router } from 'express';
import authRoutes from './authRoutes.js';
import declarationRoutes from './declarationRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/declarations', declarationRoutes);
router.use('/users', userRoutes);

export default router;
