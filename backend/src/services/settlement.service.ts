import { Transaction } from 'sequelize';
import { Member, Activity, ActivityRecord, ScoreDetail, Benefit, ExchangeOrder, LevelRule, sequelize } from '../models';
import { generateId } from '../utils/uuid';
import { encrypt, generateRedeemCode } from '../utils/crypto';
import logger from '../utils/logger';

/**
 * Grant level benefits when a member levels up.
 * Creates exchange_order records for each applicable benefit.
 */
export async function grantLevelBenefits(
  memberId: string,
  levelCode: string,
  t: Transaction
): Promise<void> {
  const benefits = await Benefit.findAll({
    where: {
      pool_type: 'level',
      level_code: levelCode,
      benefit_status: 'on',
    },
    transaction: t,
  });

  for (const benefit of benefits) {
    let redeemCode: string | null = null;
    if (benefit.benefit_type === 'virtual') {
      redeemCode = generateRedeemCode();
    }

    await ExchangeOrder.create(
      {
        order_id: generateId(),
        member_id: memberId,
        benefit_id: benefit.benefit_id,
        benefit_type: benefit.benefit_type,
        source: 'level_grant',
        points_cost: 0,
        redeem_code: redeemCode,
        order_status: 'pending',
      },
      { transaction: t }
    );
  }
}

/**
 * Check if the member qualifies for a level upgrade based on current growth_value.
 * If so, update their level and grant level benefits.
 */
export async function checkLevelUpgrade(memberId: string, t: Transaction): Promise<void> {
  const member = await Member.findByPk(memberId, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!member) return;

  const levelRules = await LevelRule.findAll({
    order: [['level_threshold', 'DESC']],
    transaction: t,
  });

  // Find the highest level where threshold <= growth_value
  let newLevel: string | null = null;
  for (const rule of levelRules) {
    if (member.growth_value >= rule.level_threshold) {
      newLevel = rule.level_code;
      break;
    }
  }

  if (!newLevel) return;

  // Compare level ranks
  const levelOrder: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };
  const currentLevelRank = levelOrder[member.member_level] || 1;
  const newLevelRank = levelOrder[newLevel] || 1;

  if (newLevelRank > currentLevelRank) {
    logger.info(`Member ${memberId} leveling up from ${member.member_level} to ${newLevel}`);
    member.member_level = newLevel as 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    await member.save({ transaction: t });
    await grantLevelBenefits(memberId, newLevel, t);
  }
}

/**
 * Settle rewards for a member after an activity record is approved.
 * Updates growth_value and points, writes score_detail records, and checks level upgrade.
 */
export async function settleRewards(
  memberId: string,
  activityId: string,
  recordId: string,
  t: Transaction
): Promise<void> {
  const activity = await Activity.findByPk(activityId, { transaction: t });
  if (!activity) throw new Error('Activity not found');

  const member = await Member.findByPk(memberId, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!member) throw new Error('Member not found');

  const growthReward = activity.growth_reward;
  const pointsReward = activity.points_reward;

  member.growth_value = member.growth_value + growthReward;
  member.points = member.points + pointsReward;
  await member.save({ transaction: t });

  // Insert score_detail records
  if (growthReward !== 0) {
    await ScoreDetail.create(
      {
        detail_id: generateId(),
        member_id: memberId,
        change_type: 'growth',
        change_value: growthReward,
        source_type: 'activity',
        source_id: recordId,
        balance_after: member.growth_value,
        remark: `Activity reward: ${activity.title}`,
      },
      { transaction: t }
    );
  }

  if (pointsReward !== 0) {
    await ScoreDetail.create(
      {
        detail_id: generateId(),
        member_id: memberId,
        change_type: 'points',
        change_value: pointsReward,
        source_type: 'activity',
        source_id: recordId,
        balance_after: member.points,
        remark: `Activity reward: ${activity.title}`,
      },
      { transaction: t }
    );
  }

  // Check for level upgrade after growth change
  await checkLevelUpgrade(memberId, t);
}

/**
 * Submit an activity and handle settlement.
 * Core settlement logic with transaction and row locking.
 */
export async function submitActivityRecord(
  memberId: string,
  activityId: string,
  submitContent: string | null
): Promise<InstanceType<typeof ActivityRecord>> {
  return sequelize.transaction(async (t) => {
    // 1. Fetch activity (must be status='active')
    const activity = await Activity.findByPk(activityId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!activity) {
      throw Object.assign(new Error('Activity not found'), { code: 1004, statusCode: 404 });
    }
    if (activity.activity_status !== 'active') {
      throw Object.assign(new Error('Activity is not active'), { code: 3006, statusCode: 400 });
    }

    // 2. Check no existing record for this member+activity
    const existing = await ActivityRecord.findOne({
      where: { member_id: memberId, activity_id: activityId },
      transaction: t,
    });
    if (existing) {
      throw Object.assign(new Error('Already participated in this activity'), {
        code: 3005,
        statusCode: 400,
      });
    }

    // 3. Determine audit_status based on settle_mode
    const auditStatus = activity.settle_mode === 'auto' ? 'approved' : 'pending';

    // 4. Create activity_record
    const record = await ActivityRecord.create(
      {
        record_id: generateId(),
        member_id: memberId,
        activity_id: activityId,
        submit_content: submitContent,
        audit_status: auditStatus,
      },
      { transaction: t }
    );

    // 5. If auto-approved, settle rewards
    if (auditStatus === 'approved') {
      await settleRewards(memberId, activityId, record.record_id, t);
    }

    return record;
  });
}

/**
 * Exchange a benefit with strong consistency (FOR UPDATE locking).
 */
export async function exchangeBenefit(
  memberId: string,
  benefitId: string,
  shippingInfo?: {
    shipping_name?: string;
    shipping_phone?: string;
    shipping_address?: string;
  }
): Promise<InstanceType<typeof ExchangeOrder>> {
  return sequelize.transaction(async (t) => {
    // 1. SELECT benefit FOR UPDATE
    const benefit = await Benefit.findByPk(benefitId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!benefit) {
      throw Object.assign(new Error('Benefit not found'), { code: 1004, statusCode: 404 });
    }
    if (benefit.benefit_status !== 'on') {
      throw Object.assign(new Error('Benefit is not available'), { code: 3004, statusCode: 400 });
    }
    if (benefit.stock <= 0) {
      throw Object.assign(new Error('Benefit is out of stock'), { code: 3004, statusCode: 400 });
    }

    // 2. SELECT member FOR UPDATE
    const member = await Member.findByPk(memberId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!member) {
      throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
    }
    if (member.points < benefit.points_cost) {
      throw Object.assign(new Error('Insufficient points'), { code: 3003, statusCode: 400 });
    }

    // 3. Check per_limit
    const existingCount = await ExchangeOrder.count({
      where: {
        member_id: memberId,
        benefit_id: benefitId,
        source: 'points_exchange',
      },
      transaction: t,
    });
    if (existingCount >= benefit.per_limit) {
      throw Object.assign(new Error('Exchange limit exceeded'), { code: 3007, statusCode: 400 });
    }

    // 4. UPDATE benefit stock
    benefit.stock = benefit.stock - 1;
    await benefit.save({ transaction: t });

    // 5. UPDATE member points
    member.points = member.points - benefit.points_cost;
    await member.save({ transaction: t });

    // 6. INSERT score_detail (negative change)
    await ScoreDetail.create(
      {
        detail_id: generateId(),
        member_id: memberId,
        change_type: 'points',
        change_value: -benefit.points_cost,
        source_type: 'exchange',
        source_id: benefitId,
        balance_after: member.points,
        remark: `Exchanged: ${benefit.benefit_name}`,
      },
      { transaction: t }
    );

    // 7. Create exchange_order
    let redeemCode: string | null = null;
    let encryptedPhone: string | null = null;
    let encryptedAddress: string | null = null;

    if (benefit.benefit_type === 'virtual') {
      redeemCode = generateRedeemCode();
    } else if (shippingInfo) {
      if (shippingInfo.shipping_phone) {
        encryptedPhone = encrypt(shippingInfo.shipping_phone);
      }
      if (shippingInfo.shipping_address) {
        encryptedAddress = encrypt(shippingInfo.shipping_address);
      }
    }

    const order = await ExchangeOrder.create(
      {
        order_id: generateId(),
        member_id: memberId,
        benefit_id: benefitId,
        benefit_type: benefit.benefit_type,
        source: 'points_exchange',
        points_cost: benefit.points_cost,
        redeem_code: redeemCode,
        shipping_name: shippingInfo?.shipping_name || null,
        shipping_phone: encryptedPhone,
        shipping_address: encryptedAddress,
        order_status: 'pending',
      },
      { transaction: t }
    );

    return order;
  });
}
