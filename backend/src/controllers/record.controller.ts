import { Request, Response } from 'express';
import * as recordService from '../services/record.service';
import {
  success,
  clientError,
  serverError,
  businessError,
  notFound,
} from '../utils/response';
import logger from '../utils/logger';
import Joi from 'joi';

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

const auditRecordSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  remark: Joi.string().max(500).optional().allow('', null),
});

export async function getMyRecords(req: Request, res: Response): Promise<void> {
  const { error, value } = paginationSchema.validate(req.query, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { rows, count } = await recordService.getMyRecords(req.user!.member_id, value);
    success(res, {
      list: rows,
      total: count,
      page: value.page,
      pageSize: value.pageSize,
    });
  } catch (err: unknown) {
    logger.error('GetMyRecords error', { error: err });
    serverError(res);
  }
}

export async function getPendingRecords(req: Request, res: Response): Promise<void> {
  const { error, value } = paginationSchema.validate(req.query, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { rows, count } = await recordService.getPendingRecords(value);
    success(res, {
      list: rows,
      total: count,
      page: value.page,
      pageSize: value.pageSize,
    });
  } catch (err: unknown) {
    logger.error('GetPendingRecords error', { error: err });
    serverError(res);
  }
}

export async function auditRecord(req: Request, res: Response): Promise<void> {
  const { error, value } = auditRecordSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const record = await recordService.auditRecord(
      req.params.id,
      req.user!.member_id,
      value.action,
      value.remark
    );
    success(res, record);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('AuditRecord error', { error: err });
      serverError(res);
    }
  }
}
