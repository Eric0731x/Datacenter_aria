import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required().max(255),
  password: Joi.string().min(6).max(100).required(),
  nickname: Joi.string().min(1).max(100).required(),
  phone: Joi.string().max(20).optional().allow('', null),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
