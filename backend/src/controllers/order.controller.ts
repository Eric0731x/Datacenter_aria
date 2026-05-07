import { Request, Response } from 'express';
import * as orderService from '../services/order.service';
import {
  success,
  created,
  clientError,
  serverError,
  businessError,
  notFound,
} from '../utils/response';
import {
  exchangeBenefitSchema,
  shipOrderSchema,
  listOrdersSchema,
} from '../validators/order.validator';
import logger from '../utils/logger';

export async function exchangeBenefit(req: Request, res: Response): Promise<void> {
  const { error, value } = exchangeBenefitSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const order = await orderService.exchange(req.user!.member_id, value);
    created(res, order);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('ExchangeBenefit error', { error: err });
      serverError(res);
    }
  }
}

export async function getMyOrders(req: Request, res: Response): Promise<void> {
  const page = parseInt(String(req.query.page || '1'), 10);
  const pageSize = Math.min(parseInt(String(req.query.pageSize || '20'), 10), 100);

  try {
    const { rows, count } = await orderService.getMyOrders(req.user!.member_id, {
      page,
      pageSize,
    });
    // Decrypt sensitive fields for each order
    const list = rows.map((o) => orderService.decryptOrderFields(o));
    success(res, { list, total: count, page, pageSize });
  } catch (err: unknown) {
    logger.error('GetMyOrders error', { error: err });
    serverError(res);
  }
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const { error, value } = listOrdersSchema.validate(req.query, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const { rows, count } = await orderService.listOrders(value);
    const list = rows.map((o) => orderService.decryptOrderFields(o));
    success(res, { list, total: count, page: value.page, pageSize: value.pageSize });
  } catch (err: unknown) {
    logger.error('ListOrders error', { error: err });
    serverError(res);
  }
}

export async function shipOrder(req: Request, res: Response): Promise<void> {
  const { error, value } = shipOrderSchema.validate(req.body, { abortEarly: false });
  if (error) {
    clientError(res, error.details.map((d) => d.message).join('; '), 1002, 422);
    return;
  }

  try {
    const order = await orderService.shipOrder(req.params.id, value.tracking_no);
    success(res, order);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('ShipOrder error', { error: err });
      serverError(res);
    }
  }
}

export async function deliverOrder(req: Request, res: Response): Promise<void> {
  try {
    const order = await orderService.deliverOrder(req.params.id);
    success(res, order);
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    if (e.code === 1004) {
      notFound(res, e.message);
    } else if (e.code && e.code >= 3000) {
      businessError(res, e.message || 'Business error', e.code);
    } else {
      logger.error('DeliverOrder error', { error: err });
      serverError(res);
    }
  }
}
