import Joi from 'joi';

export const exchangeBenefitSchema = Joi.object({
  benefit_id: Joi.string().required(),
  shipping_name: Joi.string().max(100).optional().allow('', null),
  shipping_phone: Joi.string().max(20).optional().allow('', null),
  shipping_address: Joi.string().max(500).optional().allow('', null),
});

export const shipOrderSchema = Joi.object({
  tracking_no: Joi.string().max(100).required(),
});

export const listOrdersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  order_status: Joi.string().valid('pending', 'shipped', 'delivered').optional(),
  member_id: Joi.string().optional(),
});
