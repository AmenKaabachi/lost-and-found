import express from 'express';
import routes from './routes/index.js';
import { localeMiddleware } from './errors/localization/localeMiddleware.js';
import { errorHandler } from './errors/core/errorHandler.js';
import { notFoundHandler } from './errors/middleware/notFound.js';

const app = express();

app.use(express.json());
app.use(localeMiddleware);
app.use('/api', routes);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
