import { Router } from 'express';
import {
  listExchangeBenefits,
  getLevelBenefits,
  getBenefit,
  createBenefit,
  updateBenefit,
  updateBenefitStatus,
} from '../controllers/benefit.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roleGuard.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/exchange', listExchangeBenefits);
router.get('/level/:code', getLevelBenefits);
router.get('/:id', getBenefit);
router.post('/', requireMinRole('operator'), createBenefit);
router.put('/:id', requireMinRole('operator'), updateBenefit);
router.put('/:id/status', requireMinRole('operator'), updateBenefitStatus);

export default router;
