import 'dotenv/config';
import dotenv from 'dotenv';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { localeMiddleware } from './src/errors/localization/localeMiddleware.js';
import { errorHandler } from './src/errors/core/errorHandler.js';
import { notFoundHandler } from './src/errors/middleware/notFound.js';
import { generalLimiter } from './src/middlewares/rateLimiter.js';
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import declarationRoutes from './src/routes/declarationRoutes.js';
import logger from './src/errors/logging/logger.js';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Locale AVANT les routes
app.use(localeMiddleware);

// Rate limit global
app.use(generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/declarations', declarationRoutes);

// 404 + Handler global d'erreurs
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
    
  app.listen(PORT, () => logger.info(` Server running on port ${PORT}`));
});