import express from 'express';
import routes from './routes/index.js';

const app = express();

app.use(express.json());
app.use('/api', routes);

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});

export default app;
