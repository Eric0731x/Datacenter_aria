import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 2000;
  const message = err.message || 'Internal server error';

  logger.error(`${req.method} ${req.path} - ${message}`, { stack: err.stack });

  res.status(statusCode).json({
    code,
    message,
    data: null,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    code: 1004,
    message: `Route ${req.method} ${req.path} not found`,
    data: null,
  });
}
