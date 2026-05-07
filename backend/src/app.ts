import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sequelize } from './models';
import router from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { generalRateLimiter } from './middlewares/rateLimit.middleware';
import logger from './utils/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// General rate limiting
app.use(generalRateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { status: 'healthy' } });
});

// API routes
app.use('/api/v1', router);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();

export default app;
