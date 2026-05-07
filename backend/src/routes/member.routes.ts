import { Router } from 'express';
import {
  getMyProfile,
  updateMyProfile,
  getMyScoreDetails,
  listMembers,
  getMemberById,
  updateMemberStatus,
  adjustScore,
} from '../controllers/member.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireMinRole } from '../middlewares/roleGuard.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Own profile routes
router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);
router.get('/me/score-details', getMyScoreDetails);

// Admin/operator routes
router.get('/', requireMinRole('operator'), listMembers);
router.get('/:id', requireMinRole('operator'), getMemberById);
router.put('/:id/status', requireMinRole('admin'), updateMemberStatus);
router.post('/:id/adjust', requireMinRole('admin'), adjustScore);

export default router;
