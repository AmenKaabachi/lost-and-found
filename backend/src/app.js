import express from 'express';
import routes from './routes/index.js';
import { errorHandler, localeMiddleware, notFound, translate } from './errors/index.js';

const app = express();

app.locals.translate = translate;
app.use(express.json());
app.use(localeMiddleware);
app.use('/api', routes);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use(notFound);
app.use(errorHandler);

export default app;
