import { Request, Response, NextFunction } from 'express';
import { forbidden } from '../utils/response';
import { MemberRole } from '../models/member.model';

const roleHierarchy: Record<MemberRole, number> = {
  member: 1,
  mentor: 2,
  operator: 3,
  admin: 4,
};

export function requireRole(...roles: MemberRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      forbidden(res, 'Not authenticated');
      return;
    }

    const userRoleLevel = roleHierarchy[user.role as MemberRole] || 0;
    const minRequired = Math.min(...roles.map((r) => roleHierarchy[r]));

    if (userRoleLevel < minRequired) {
      forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: MemberRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      forbidden(res, 'Not authenticated');
      return;
    }

    const userRoleLevel = roleHierarchy[user.role as MemberRole] || 0;
    const required = roleHierarchy[minRole];

    if (userRoleLevel < required) {
      forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
}

export function hasMinRole(role: string, minRole: MemberRole): boolean {
  const userRoleLevel = roleHierarchy[role as MemberRole] || 0;
  return userRoleLevel >= roleHierarchy[minRole];
}
