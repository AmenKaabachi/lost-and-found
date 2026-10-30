import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateRequest } from '../validation/validateRequest.js';
import { demoController } from './demo.controller.js';
import { declarationIdSchema, declarationSchema } from './demo.schema.js';

const router = Router();
router.get('/health', demoController.health);
router.get('/declarations', demoController.list);
router.get('/declarations/:id', validateRequest(declarationIdSchema, 'params'), asyncHandler(demoController.get));
router.post('/declarations', validateRequest(declarationSchema), asyncHandler(demoController.create));
router.delete('/declarations/:id', validateRequest(declarationIdSchema, 'params'), asyncHandler(demoController.remove));
if (process.env.NODE_ENV !== 'production') router.get('/test-error', asyncHandler(demoController.testError));

export default router;
