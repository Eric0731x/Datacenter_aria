import { ExchangeOrder } from '../models';
import { exchangeBenefit } from './settlement.service';
import { decrypt } from '../utils/crypto';

export interface ExchangeInput {
  benefit_id: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
}

export interface ListOrdersQuery {
  page: number;
  pageSize: number;
  order_status?: string;
  member_id?: string;
}

export async function exchange(
  memberId: string,
  input: ExchangeInput
): Promise<InstanceType<typeof ExchangeOrder>> {
  return exchangeBenefit(memberId, input.benefit_id, {
    shipping_name: input.shipping_name,
    shipping_phone: input.shipping_phone,
    shipping_address: input.shipping_address,
  });
}

export async function getMyOrders(
  memberId: string,
  query: { page: number; pageSize: number }
): Promise<{ rows: InstanceType<typeof ExchangeOrder>[]; count: number }> {
  const { page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  const { rows, count } = await ExchangeOrder.findAndCountAll({
    where: { member_id: memberId },
    order: [['create_time', 'DESC']],
    limit: pageSize,
    offset,
  });

  return { rows, count };
}

export async function listOrders(
  query: ListOrdersQuery
): Promise<{ rows: InstanceType<typeof ExchangeOrder>[]; count: number }> {
  const { page, pageSize, order_status, member_id } = query;
  const offset = (page - 1) * pageSize;
  const where: Record<string, unknown> = {};

  if (order_status) where.order_status = order_status;
  if (member_id) where.member_id = member_id;

  const { rows, count } = await ExchangeOrder.findAndCountAll({
    where,
    order: [['create_time', 'DESC']],
    limit: pageSize,
    offset,
  });

  return { rows, count };
}

export async function shipOrder(
  orderId: string,
  trackingNo: string
): Promise<InstanceType<typeof ExchangeOrder>> {
  const order = await ExchangeOrder.findByPk(orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { code: 1004, statusCode: 404 });
  }
  if (order.order_status !== 'pending') {
    throw Object.assign(new Error('Order is not in pending status'), {
      code: 3012,
      statusCode: 400,
    });
  }

  order.order_status = 'shipped';
  order.tracking_no = trackingNo;
  order.ship_time = new Date();
  await order.save();
  return order;
}

export async function deliverOrder(orderId: string): Promise<InstanceType<typeof ExchangeOrder>> {
  const order = await ExchangeOrder.findByPk(orderId);
  if (!order) {
    throw Object.assign(new Error('Order not found'), { code: 1004, statusCode: 404 });
  }
  if (order.order_status !== 'shipped') {
    throw Object.assign(new Error('Order is not in shipped status'), {
      code: 3012,
      statusCode: 400,
    });
  }

  order.order_status = 'delivered';
  order.deliver_time = new Date();
  await order.save();
  return order;
}

/**
 * Decrypt sensitive fields for display (only call when appropriate).
 */
export function decryptOrderFields(order: InstanceType<typeof ExchangeOrder>): Record<string, unknown> {
  const plain = order.toJSON() as unknown as Record<string, unknown>;

  if (order.shipping_phone) {
    try {
      plain.shipping_phone = decrypt(order.shipping_phone);
    } catch {
      plain.shipping_phone = '***';
    }
  }
  if (order.shipping_address) {
    try {
      plain.shipping_address = decrypt(order.shipping_address);
    } catch {
      plain.shipping_address = '***';
    }
  }
  // redeem_code is kept encrypted in the DB; expose raw encrypted value or decrypt for virtual
  if (order.redeem_code) {
    try {
      plain.redeem_code = decrypt(order.redeem_code);
    } catch {
      plain.redeem_code = '***';
    }
  }

  return plain;
}
