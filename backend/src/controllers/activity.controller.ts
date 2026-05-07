import { Request, Response } from 'express';
import * as activityService from '../services/activity.service';
import { submitActivityRecord } from '../services/settlement.service';
import {
  success,
  created,
  clientError,
  serverError,
  businessError,
  notFound,
} from '../utils/response';
import {
  createActivitySchema,
  updateActivitySchema,
  auditActivitySchema,
  submitActivitySchema,
  listActivitiesSchema,
} from '../validators/activity.validator';
import logger from '../utils/logger';

export async function listActivities(req: Request, res: Response): Promise<void> {
  const { error, value } = listActivitiesSchema.validate(req.query, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { rows, count } = await activityService.listActivities(value);
    success(res, {
      list: rows,
      total: count,
      page: value.page,
      pageSize: value.pageSize,
    });
  } catch (err: unknown) {
    logger.error('ListActivities error', { error: err });
    serverError(res);
  }
}

export async function getActivity(req: Request, res: Response): Promise<void> {
  try {
    const activity = await activityService.getActivity(req.params.id);
    success(res, activity);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('GetActivity error', { error: err });
      serverError(res);
    }
  }
}

export async function createActivity(req: Request, res: Response): Promise<void> {
  const { error, value } = createActivitySchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const activity = await activityService.createActivity(req.user!.member_id, value);
    created(res, activity);
  } catch (err: unknown) {
    logger.error('CreateActivity error', { error: err });
    serverError(res);
  }
}

export async function updateActivity(req: Request, res: Response): Promise<void> {
  const { error, value } = updateActivitySchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const activity = await activityService.updateActivity(
      req.params.id,
      req.user!.member_id,
      req.user!.role,
      value
    );
    success(res, activity);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code === 1003) {
      clientError(res, e.message || 'Forbidden', 1003, 403);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('UpdateActivity error', { error: err });
      serverError(res);
    }
  }
}

export async function auditActivity(req: Request, res: Response): Promise<void> {
  const { error, value } = auditActivitySchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const activity = await activityService.auditActivity(req.params.id, value.action, value.remark);
    success(res, activity);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('AuditActivity error', { error: err });
      serverError(res);
    }
  }
}

export async function participateActivity(req: Request, res: Response): Promise<void> {
  try {
    const activity = await activityService.participateActivity(
      req.user!.member_id,
      req.params.id
    );
    success(res, { activity_id: activity.activity_id, message: 'Participation registered' });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('ParticipateActivity error', { error: err });
      serverError(res);
    }
  }
}

export async function submitActivity(req: Request, res: Response): Promise<void> {
  const { error, value } = submitActivitySchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const record = await submitActivityRecord(
      req.user!.member_id,
      req.params.id,
      value.submit_content || null
    );
    success(res, record);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('SubmitActivity error', { error: err });
      serverError(res);
    }
  }
}
