
import 'dotenv/config';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import app from './src/app.js';
import logger from './src/errors/logging/logger.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}).catch((error) => {
  logger.error(error);
  process.exit(1);
});
