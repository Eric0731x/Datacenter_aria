import Joi from 'joi';

export const createBenefitSchema = Joi.object({
  benefit_name: Joi.string().min(1).max(200).required(),
  description: Joi.string().optional().allow('', null),
  image_url: Joi.string().uri().optional().allow('', null),
  benefit_type: Joi.string().valid('virtual', 'physical').required(),
  pool_type: Joi.string().valid('level', 'exchange').required(),
  points_cost: Joi.number().integer().min(0).default(0),
  level_code: Joi.string().valid('L1', 'L2', 'L3', 'L4', 'L5').optional().allow(null),
  stock: Joi.number().integer().min(0).required(),
  per_limit: Joi.number().integer().min(1).default(1),
});

export const updateBenefitSchema = Joi.object({
  benefit_name: Joi.string().min(1).max(200).optional(),
  description: Joi.string().optional().allow('', null),
  image_url: Joi.string().uri().optional().allow('', null),
  benefit_type: Joi.string().valid('virtual', 'physical').optional(),
  pool_type: Joi.string().valid('level', 'exchange').optional(),
  points_cost: Joi.number().integer().min(0).optional(),
  level_code: Joi.string().valid('L1', 'L2', 'L3', 'L4', 'L5').optional().allow(null),
  stock: Joi.number().integer().min(0).optional(),
  per_limit: Joi.number().integer().min(1).optional(),
});

export const updateBenefitStatusSchema = Joi.object({
  benefit_status: Joi.string().valid('on', 'off').required(),
});
