import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { loginRateLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', loginRateLimiter, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
