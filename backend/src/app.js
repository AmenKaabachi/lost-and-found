import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { localeMiddleware } from './errors/localization/localeMiddleware.js';
import { errorHandler } from './errors/core/errorHandler.js';
import { notFoundHandler } from './errors/middleware/notFound.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(localeMiddleware);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
