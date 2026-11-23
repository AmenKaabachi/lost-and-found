
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import routes from './routes/index.js';
import swaggerFile from '../swagger-output.json' with { type: 'json' };

import { localeMiddleware } from './errors/localization/localeMiddleware.js';
import { errorHandler } from './errors/core/errorHandler.js';
import { notFoundHandler } from './errors/middleware/notFound.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

const app = express();

// Sécurité et configuration
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Fichiers statiques des photos
app.use('/uploads', express.static('uploads'));

// Localisation
app.use(localeMiddleware);

// Limitation globale des requêtes
app.use(generalLimiter);

// Vérification du serveur
app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

// Documentation Swagger Autogen
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Routes API
app.use('/api', routes);

// Gestion des erreurs
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
