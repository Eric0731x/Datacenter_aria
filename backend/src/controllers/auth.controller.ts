import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { success, created, clientError, serverError, businessError } from '../utils/response';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import logger from '../utils/logger';

export async function register(req: Request, res: Response): Promise<void> {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { member, token } = await authService.register(value);
    created(res, {
      token,
      member: {
        member_id: member.member_id,
        email: member.email,
        nickname: member.nickname,
        role: member.role,
        member_level: member.member_level,
        growth_value: member.growth_value,
        points: member.points,
        member_status: member.member_status,
        register_time: member.register_time,
      },
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string; statusCode?: number };
    if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('Register error', { error: err });
      serverError(res);
    }
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { member, token } = await authService.login(value);
    success(res, {
      token,
      member: {
        member_id: member.member_id,
        email: member.email,
        nickname: member.nickname,
        role: member.role,
        member_level: member.member_level,
        growth_value: member.growth_value,
        points: member.points,
        member_status: member.member_status,
        register_time: member.register_time,
      },
    });
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string; statusCode?: number };
    if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('Login error', { error: err });
      serverError(res);
    }
  }
}

export function logout(req: Request, res: Response): void {
  // JWT is stateless; client should discard the token
  success(res, null, 'Logged out successfully');
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const member = await authService.getMe(req.user!.member_id);
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
    logger.error('GetMe error', { error: err });
    serverError(res);
  }
}
