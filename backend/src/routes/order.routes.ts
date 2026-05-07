import { Router } from 'express';
import {
  exchangeBenefit,
  getMyOrders,
  listOrders,
  shipOrder,
  deliverOrder,
} from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roleGuard.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/exchange', exchangeBenefit);
router.get('/me', getMyOrders);
router.get('/', requireMinRole('operator'), listOrders);
router.put('/:id/ship', requireMinRole('operator'), shipOrder);
router.put('/:id/deliver', requireMinRole('operator'), deliverOrder);

export default router;
