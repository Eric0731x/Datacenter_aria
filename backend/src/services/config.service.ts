import { LevelRule, Member, Activity, ActivityRecord, ExchangeOrder } from '../models';
import { Op } from 'sequelize';

export async function getLevelRules(): Promise<InstanceType<typeof LevelRule>[]> {
  return LevelRule.findAll({
    order: [['display_order', 'ASC']],
  });
}

export async function updateLevelRule(
  levelCode: string,
  data: { level_threshold?: number; level_name?: string; level_benefit_desc?: string }
): Promise<InstanceType<typeof LevelRule>> {
  const rule = await LevelRule.findByPk(levelCode);
  if (!rule) {
    throw Object.assign(new Error('Level rule not found'), { code: 1004, statusCode: 404 });
  }

  if (data.level_threshold !== undefined) rule.level_threshold = data.level_threshold;
  if (data.level_name !== undefined) rule.level_name = data.level_name;
  if (data.level_benefit_desc !== undefined) rule.level_benefit_desc = data.level_benefit_desc;

  await rule.save();
  return rule;
}

export async function getStats(): Promise<Record<string, unknown>> {
  const [
    totalMembers,
    activeMembers,
    frozenMembers,
    totalActivities,
    activeActivities,
    pendingActivities,
    totalRecords,
    pendingRecords,
    approvedRecords,
    totalOrders,
    pendingOrders,
    shippedOrders,
    deliveredOrders,
  ] = await Promise.all([
    Member.count(),
    Member.count({ where: { member_status: 'active' } }),
    Member.count({ where: { member_status: 'frozen' } }),
    Activity.count(),
    Activity.count({ where: { activity_status: 'active' } }),
    Activity.count({ where: { activity_status: 'pending' } }),
    ActivityRecord.count(),
    ActivityRecord.count({ where: { audit_status: 'pending' } }),
    ActivityRecord.count({ where: { audit_status: 'approved' } }),
    ExchangeOrder.count(),
    ExchangeOrder.count({ where: { order_status: 'pending' } }),
    ExchangeOrder.count({ where: { order_status: 'shipped' } }),
    ExchangeOrder.count({ where: { order_status: 'delivered' } }),
  ]);

  const levelDistribution = await Member.findAll({
    attributes: [
      'member_level',
      [Member.sequelize!.fn('COUNT', Member.sequelize!.col('member_id')), 'count'],
    ],
    group: ['member_level'],
    raw: true,
  });

  return {
    members: {
      total: totalMembers,
      active: activeMembers,
      frozen: frozenMembers,
      level_distribution: levelDistribution,
    },
    activities: {
      total: totalActivities,
      active: activeActivities,
      pending: pendingActivities,
    },
    records: {
      total: totalRecords,
      pending: pendingRecords,
      approved: approvedRecords,
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      shipped: shippedOrders,
      delivered: deliveredOrders,
    },
  };
}
