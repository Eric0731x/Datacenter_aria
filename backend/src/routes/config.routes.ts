import { Router } from 'express';
import { getLevelRules, updateLevelRule, getStats } from '../controllers/config.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roleGuard.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/levels', getLevelRules);
router.put('/levels/:code', requireMinRole('admin'), updateLevelRule);
router.get('/stats', requireMinRole('operator'), getStats);

export default router;
