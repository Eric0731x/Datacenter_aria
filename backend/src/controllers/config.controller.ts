import { Request, Response } from 'express';
import * as configService from '../services/config.service';
import { success, clientError, serverError, notFound } from '../utils/response';
import Joi from 'joi';
import logger from '../utils/logger';

const updateLevelRuleSchema = Joi.object({
  level_threshold: Joi.number().integer().min(0).optional(),
  level_name: Joi.string().max(50).optional(),
  level_benefit_desc: Joi.string().optional().allow('', null),
});

export async function getLevelRules(req: Request, res: Response): Promise<void> {
  try {
    const rules = await configService.getLevelRules();
    success(res, { list: rules });
  } catch (err: unknown) {
    logger.error('GetLevelRules error', { error: err });
    serverError(res);
  }
}

export async function updateLevelRule(req: Request, res: Response): Promise<void> {
  const { error, value } = updateLevelRuleSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const rule = await configService.updateLevelRule(req.params.code, value);
    success(res, rule);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else {
      logger.error('UpdateLevelRule error', { error: err });
      serverError(res);
    }
  }
}

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await configService.getStats();
    success(res, stats);
  } catch (err: unknown) {
    logger.error('GetStats error', { error: err });
    serverError(res);
  }
}
