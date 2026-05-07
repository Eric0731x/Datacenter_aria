import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  nickname: Joi.string().min(1).max(100).optional(),
  phone: Joi.string().max(20).optional().allow('', null),
});

export const listMembersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  email: Joi.string().optional().allow(''),
  nickname: Joi.string().optional().allow(''),
  role: Joi.string().valid('member', 'mentor', 'operator', 'admin').optional(),
  member_status: Joi.string().valid('active', 'frozen').optional(),
  member_level: Joi.string().valid('L1', 'L2', 'L3', 'L4', 'L5').optional(),
});

export const updateStatusSchema = Joi.object({
  member_status: Joi.string().valid('active', 'frozen').required(),
});

export const adjustScoreSchema = Joi.object({
  change_type: Joi.string().valid('growth', 'points').required(),
  change_value: Joi.number().integer().required(),
  remark: Joi.string().max(500).optional().allow('', null),
});

export const scoreDetailsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  change_type: Joi.string().valid('growth', 'points').optional(),
});
