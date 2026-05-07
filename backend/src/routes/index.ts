import { Router } from 'express';
import authRoutes from './auth.routes';
import memberRoutes from './member.routes';
import activityRoutes from './activity.routes';
import recordRoutes from './record.routes';
import benefitRoutes from './benefit.routes';
import orderRoutes from './order.routes';
import configRoutes from './config.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/members', memberRoutes);
router.use('/activities', activityRoutes);
router.use('/records', recordRoutes);
router.use('/benefits', benefitRoutes);
router.use('/orders', orderRoutes);
router.use('/config', configRoutes);

export default router;
