import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: {
    code: 1005,
    message: 'Too many login attempts, please try again later',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    code: 1005,
    message: 'Too many requests, please try again later',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
