import { Router } from 'express';
import {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  auditActivity,
  participateActivity,
  submitActivity,
} from '../controllers/activity.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roleGuard.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', listActivities);
router.get('/:id', getActivity);
router.post('/', requireMinRole('mentor'), createActivity);
router.put('/:id', requireMinRole('mentor'), updateActivity);
router.post('/:id/audit', requireMinRole('operator'), auditActivity);
router.post('/:id/participate', participateActivity);
router.post('/:id/submit', submitActivity);

export default router;
