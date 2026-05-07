import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { unauthorized } from '../utils/response';
import { Member } from '../models';

export interface JwtPayload {
  member_id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      member?: InstanceType<typeof Member>;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    unauthorized(res, 'Missing or invalid authorization header');
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    unauthorized(res, 'JWT secret not configured');
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    unauthorized(res, 'Invalid or expired token');
  }
}

export async function loadMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    unauthorized(res, 'Not authenticated');
    return;
  }

  const member = await Member.findByPk(req.user.member_id);
  if (!member) {
    unauthorized(res, 'Member not found');
    return;
  }

  if (member.member_status === 'frozen') {
    unauthorized(res, 'Account is frozen');
    return;
  }

  req.member = member;
  next();
}
