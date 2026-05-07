import { Request, Response } from 'express';
import * as memberService from '../services/member.service';
import {
  success,
  clientError,
  serverError,
  businessError,
  notFound,
} from '../utils/response';
import {
  updateProfileSchema,
  listMembersSchema,
  updateStatusSchema,
  adjustScoreSchema,
  scoreDetailsQuerySchema,
} from '../validators/member.validator';
import logger from '../utils/logger';

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const member = await memberService.getProfile(req.user!.member_id);
    success(res, {
      member_id: member.member_id,
      email: member.email,
      nickname: member.nickname,
      phone: member.phone,
      role: member.role,
      member_level: member.member_level,
      growth_value: member.growth_value,
      points: member.points,
      member_status: member.member_status,
      register_time: member.register_time,
    });
  } catch (err: unknown) {
    logger.error('GetMyProfile error', { error: err });
    serverError(res);
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const member = await memberService.updateProfile(req.user!.member_id, value);
    success(res, {
      member_id: member.member_id,
      email: member.email,
      nickname: member.nickname,
      phone: member.phone,
      role: member.role,
      member_level: member.member_level,
      growth_value: member.growth_value,
      points: member.points,
      member_status: member.member_status,
      register_time: member.register_time,
    });
  } catch (err: unknown) {
    logger.error('UpdateMyProfile error', { error: err });
    serverError(res);
  }
}

export async function getMyScoreDetails(req: Request, res: Response): Promise<void> {
  const { error, value } = scoreDetailsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { rows, count } = await memberService.getScoreDetails(req.user!.member_id, value);
    success(res, {
      list: rows,
      total: count,
      page: value.page,
      pageSize: value.pageSize,
    });
  } catch (err: unknown) {
    logger.error('GetMyScoreDetails error', { error: err });
    serverError(res);
  }
}

export async function listMembers(req: Request, res: Response): Promise<void> {
  const { error, value } = listMembersSchema.validate(req.query, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { rows, count } = await memberService.listMembers(value);
    success(res, {
      list: rows,
      total: count,
      page: value.page,
      pageSize: value.pageSize,
    });
  } catch (err: unknown) {
    logger.error('ListMembers error', { error: err });
    serverError(res);
  }
}

export async function getMemberById(req: Request, res: Response): Promise<void> {
  try {
    const member = await memberService.getMemberById(req.params.id);
    success(res, member);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('GetMemberById error', { error: err });
      serverError(res);
    }
  }
}

export async function updateMemberStatus(req: Request, res: Response): Promise<void> {
  const { error, value } = updateStatusSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const member = await memberService.updateMemberStatus(req.params.id, value.member_status);
    success(res, {
      member_id: member.member_id,
      member_status: member.member_status,
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('UpdateMemberStatus error', { error: err });
      serverError(res);
    }
  }
}

export async function adjustScore(req: Request, res: Response): Promise<void> {
  const { error, value } = adjustScoreSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const detail = await memberService.adjustScore(req.params.id, req.user!.member_id, value);
    success(res, detail);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('AdjustScore error', { error: err });
      serverError(res);
    }
  }
}
