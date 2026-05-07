import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export function success<T>(res: Response, data: T, message = 'ok', statusCode = 200): Response {
  return res.status(statusCode).json({
    code: 0,
    message,
    data,
  } as ApiResponse<T>);
}

export function created<T>(res: Response, data: T, message = 'created'): Response {
  return success(res, data, message, 201);
}

export function clientError(
  res: Response,
  message: string,
  code = 1000,
  statusCode = 400
): Response {
  return res.status(statusCode).json({
    code,
    message,
    data: null,
  });
}

export function unauthorized(res: Response, message = 'Unauthorized'): Response {
  return clientError(res, message, 1001, 401);
}

export function forbidden(res: Response, message = 'Forbidden'): Response {
  return clientError(res, message, 1003, 403);
}

export function notFound(res: Response, message = 'Not found'): Response {
  return clientError(res, message, 1004, 404);
}

export function validationError(res: Response, message: string): Response {
  return clientError(res, message, 1002, 422);
}

export function businessError(res: Response, message: string, code = 3000): Response {
  return res.status(200).json({
    code,
    message,
    data: null,
  });
}

export function serverError(res: Response, message = 'Internal server error'): Response {
  return res.status(500).json({
    code: 2000,
    message,
    data: null,
  });
}

// Error code constants
export const ErrorCodes = {
  SUCCESS: 0,
  // Client errors 1xxx
  VALIDATION_ERROR: 1002,
  UNAUTHORIZED: 1001,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  // Server errors 2xxx
  SERVER_ERROR: 2000,
  DB_ERROR: 2001,
  // Business errors 3xxx
  DUPLICATE_EMAIL: 3001,
  INVALID_CREDENTIALS: 3002,
  INSUFFICIENT_POINTS: 3003,
  OUT_OF_STOCK: 3004,
  ALREADY_PARTICIPATED: 3005,
  ACTIVITY_NOT_ACTIVE: 3006,
  EXCEED_PER_LIMIT: 3007,
  MEMBER_FROZEN: 3008,
  LEVEL_NOT_MET: 3009,
};
