import { Router } from 'express';

import authRoutes from './authRoutes.js';
import declarationRoutes from './declarationRoutes.js';
import userRoutes from './userRoutes.js';
import matchRouter from './matchRoutes.js';
import declarationMatchRouter from './declarationMatchRoutes.js';
import matchingConflictRouter from './matchingConflictRoutes.js';
import resolutionRoutes from './resolutionRoutes.js';
import adminRoutes from './adminRoutes.js';
import reportRoutes from './reportRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/matches', matchRouter);
router.use('/matching/conflicts', matchingConflictRouter);
router.use('/resolutions', resolutionRoutes);
router.use('/declarations', declarationMatchRouter);
router.use('/declarations', declarationRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/declarations', reportRoutes);

export default router;