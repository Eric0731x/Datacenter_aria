import Joi from 'joi';

export const createActivitySchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().optional().allow('', null),
  activity_type: Joi.string()
    .valid('checkin', 'cobuilding', 'sharing', 'submission', 'qa')
    .required(),
  settle_mode: Joi.string().valid('auto', 'audit').required(),
  growth_reward: Joi.number().integer().min(0).default(0),
  points_reward: Joi.number().integer().min(0).default(0),
  start_time: Joi.date().iso().required(),
  end_time: Joi.date().iso().greater(Joi.ref('start_time')).required(),
});

export const updateActivitySchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  description: Joi.string().optional().allow('', null),
  activity_type: Joi.string()
    .valid('checkin', 'cobuilding', 'sharing', 'submission', 'qa')
    .optional(),
  settle_mode: Joi.string().valid('auto', 'audit').optional(),
  growth_reward: Joi.number().integer().min(0).optional(),
  points_reward: Joi.number().integer().min(0).optional(),
  start_time: Joi.date().iso().optional(),
  end_time: Joi.date().iso().optional(),
});

export const auditActivitySchema = Joi.object({
  action: Joi.string().valid('approve', 'reject').required(),
  remark: Joi.string().max(500).optional().allow('', null),
});

export const submitActivitySchema = Joi.object({
  submit_content: Joi.string().optional().allow('', null),
});

export const listActivitiesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  activity_status: Joi.string().valid('pending', 'active', 'ended', 'rejected').optional(),
  activity_type: Joi.string()
    .valid('checkin', 'cobuilding', 'sharing', 'submission', 'qa')
    .optional(),
});
