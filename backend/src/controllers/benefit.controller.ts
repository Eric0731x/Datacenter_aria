import { Request, Response } from 'express';
import * as benefitService from '../services/benefit.service';
import {
  success,
  created,
  clientError,
  serverError,
  notFound,
} from '../utils/response';
import {
  createBenefitSchema,
  updateBenefitSchema,
  updateBenefitStatusSchema,
} from '../validators/benefit.validator';
import logger from '../utils/logger';

export async function listExchangeBenefits(req: Request, res: Response): Promise<void> {
  try {
    const benefits = await benefitService.listExchangeBenefits();
    success(res, { list: benefits, total: benefits.length });
  } catch (err: unknown) {
    logger.error('ListExchangeBenefits error', { error: err });
    serverError(res);
  }
}

export async function getLevelBenefits(req: Request, res: Response): Promise<void> {
  try {
    const benefits = await benefitService.getLevelBenefits(req.params.code);
    success(res, { list: benefits, total: benefits.length });
  } catch (err: unknown) {
    logger.error('GetLevelBenefits error', { error: err });
    serverError(res);
  }
}

export async function getBenefit(req: Request, res: Response): Promise<void> {
  try {
    const benefit = await benefitService.getBenefit(req.params.id);
    success(res, benefit);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('GetBenefit error', { error: err });
      serverError(res);
    }
  }
}

export async function createBenefit(req: Request, res: Response): Promise<void> {
  const { error, value } = createBenefitSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const benefit = await benefitService.createBenefit(value);
    created(res, benefit);
  } catch (err: unknown) {
    logger.error('CreateBenefit error', { error: err });
    serverError(res);
  }
}

export async function updateBenefit(req: Request, res: Response): Promise<void> {
  const { error, value } = updateBenefitSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const benefit = await benefitService.updateBenefit(req.params.id, value);
    success(res, benefit);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('UpdateBenefit error', { error: err });
      serverError(res);
    }
  }
}

export async function updateBenefitStatus(req: Request, res: Response): Promise<void> {
  const { error, value } = updateBenefitStatusSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const benefit = await benefitService.updateBenefitStatus(req.params.id, value.benefit_status);
    success(res, benefit);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('UpdateBenefitStatus error', { error: err });
      serverError(res);
    }
  }
}
