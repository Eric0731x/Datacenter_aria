import { Activity } from '../models';
import { generateId } from '../utils/uuid';
import { hasMinRole } from '../middlewares/roleGuard.middleware';

export interface CreateActivityInput {
  title: string;
  description?: string | null;
  activity_type: 'checkin' | 'cobuilding' | 'sharing' | 'submission' | 'qa';
  settle_mode: 'auto' | 'audit';
  growth_reward?: number;
  points_reward?: number;
  start_time: Date;
  end_time: Date;
}

export interface ListActivitiesQuery {
  page: number;
  pageSize: number;
  activity_status?: string;
  activity_type?: string;
}

export async function listActivities(
  query: ListActivitiesQuery
): Promise<{ rows: InstanceType<typeof Activity>[]; count: number }> {
  const { page, pageSize, activity_status, activity_type } = query;
  const offset = (page - 1) * pageSize;
  const where: Record<string, unknown> = {};

  if (activity_status) where.activity_status = activity_status;
  if (activity_type) where.activity_type = activity_type;

  const { rows, count } = await Activity.findAndCountAll({
    where,
    order: [['create_time', 'DESC']],
    limit: pageSize,
    offset,
  });

  return { rows, count };
}

export async function getActivity(id: string): Promise<InstanceType<typeof Activity>> {
  const activity = await Activity.findByPk(id);
  if (!activity) {
    throw Object.assign(new Error('Activity not found'), { code: 1004, statusCode: 404 });
  }
  return activity;
}

export async function createActivity(
  creatorId: string,
  input: CreateActivityInput
): Promise<InstanceType<typeof Activity>> {
  const activity = await Activity.create({
    activity_id: generateId(),
    title: input.title,
    description: input.description || null,
    activity_type: input.activity_type,
    settle_mode: input.settle_mode,
    growth_reward: input.growth_reward || 0,
    points_reward: input.points_reward || 0,
    start_time: input.start_time,
    end_time: input.end_time,
    creator_id: creatorId,
    activity_status: 'pending',
  });
  return activity;
}

export async function updateActivity(
  id: string,
  requesterId: string,
  requesterRole: string,
  input: Partial<CreateActivityInput>
): Promise<InstanceType<typeof Activity>> {
  const activity = await Activity.findByPk(id);
  if (!activity) {
    throw Object.assign(new Error('Activity not found'), { code: 1004, statusCode: 404 });
  }
  if (activity.activity_status !== 'pending') {
    throw Object.assign(new Error('Only pending activities can be updated'), {
      code: 3010,
      statusCode: 400,
    });
  }

  // mentor can only update their own; operator+ can update any
  if (!hasMinRole(requesterRole, 'operator') && activity.creator_id !== requesterId) {
    throw Object.assign(new Error('Forbidden: not the creator'), { code: 1003, statusCode: 403 });
  }

  if (input.title !== undefined) activity.title = input.title;
  if (input.description !== undefined) activity.description = input.description || null;
  if (input.activity_type !== undefined) activity.activity_type = input.activity_type;
  if (input.settle_mode !== undefined) activity.settle_mode = input.settle_mode;
  if (input.growth_reward !== undefined) activity.growth_reward = input.growth_reward;
  if (input.points_reward !== undefined) activity.points_reward = input.points_reward;
  if (input.start_time !== undefined) activity.start_time = input.start_time;
  if (input.end_time !== undefined) activity.end_time = input.end_time;

  await activity.save();
  return activity;
}

export async function auditActivity(
  id: string,
  action: 'approve' | 'reject',
  remark?: string
): Promise<InstanceType<typeof Activity>> {
  const activity = await Activity.findByPk(id);
  if (!activity) {
    throw Object.assign(new Error('Activity not found'), { code: 1004, statusCode: 404 });
  }
  if (activity.activity_status !== 'pending') {
    throw Object.assign(new Error('Activity is not in pending status'), {
      code: 3010,
      statusCode: 400,
    });
  }

  activity.activity_status = action === 'approve' ? 'active' : 'rejected';
  await activity.save();
  return activity;
}

export async function participateActivity(
  memberId: string,
  activityId: string
): Promise<InstanceType<typeof Activity>> {
  // Just verifies activity is active; actual record creation done in record service
  const activity = await Activity.findByPk(activityId);
  if (!activity) {
    throw Object.assign(new Error('Activity not found'), { code: 1004, statusCode: 404 });
  }
  if (activity.activity_status !== 'active') {
    throw Object.assign(new Error('Activity is not active'), { code: 3006, statusCode: 400 });
  }
  return activity;
}
