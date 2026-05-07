import { Router } from 'express';
import {
  getMyRecords,
  getPendingRecords,
  auditRecord,
} from '../controllers/record.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roleGuard.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/me', getMyRecords);
router.get('/pending', requireMinRole('operator'), getPendingRecords);
router.post('/:id/audit', requireMinRole('operator'), auditRecord);

export default router;
