import { Op } from 'sequelize';
import { Member, ScoreDetail, sequelize } from '../models';
import { generateId } from '../utils/uuid';

export interface ListMembersQuery {
  page: number;
  pageSize: number;
  email?: string;
  nickname?: string;
  role?: string;
  member_status?: string;
  member_level?: string;
}

export interface ScoreDetailsQuery {
  page: number;
  pageSize: number;
  change_type?: string;
}

export async function getProfile(member_id: string): Promise<InstanceType<typeof Member>> {
  const member = await Member.findByPk(member_id);
  if (!member) {
    throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
  }
  return member;
}

export async function updateProfile(
  member_id: string,
  data: { nickname?: string; phone?: string | null }
): Promise<InstanceType<typeof Member>> {
  const member = await Member.findByPk(member_id);
  if (!member) {
    throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
  }

  if (data.nickname !== undefined) member.nickname = data.nickname;
  if (data.phone !== undefined) member.phone = data.phone;
  await member.save();
  return member;
}

export async function getScoreDetails(
  member_id: string,
  query: ScoreDetailsQuery
): Promise<{ rows: InstanceType<typeof ScoreDetail>[]; count: number }> {
  const { page, pageSize, change_type } = query;
  const offset = (page - 1) * pageSize;

  const where: Record<string, unknown> = { member_id };
  if (change_type) where.change_type = change_type;

  const { rows, count } = await ScoreDetail.findAndCountAll({
    where,
    order: [['create_time', 'DESC']],
    limit: pageSize,
    offset,
  });

  return { rows, count };
}

export async function listMembers(
  query: ListMembersQuery
): Promise<{ rows: InstanceType<typeof Member>[]; count: number }> {
  const { page, pageSize, email, nickname, role, member_status, member_level } = query;
  const offset = (page - 1) * pageSize;
  const where: Record<string, unknown> = {};

  if (email) where.email = { [Op.like]: `%${email}%` };
  if (nickname) where.nickname = { [Op.like]: `%${nickname}%` };
  if (role) where.role = role;
  if (member_status) where.member_status = member_status;
  if (member_level) where.member_level = member_level;

  const { rows, count } = await Member.findAndCountAll({
    where,
    order: [['register_time', 'DESC']],
    limit: pageSize,
    offset,
    attributes: { exclude: ['password'] },
  });

  return { rows, count };
}

export async function getMemberById(id: string): Promise<InstanceType<typeof Member>> {
  const member = await Member.findByPk(id, {
    attributes: { exclude: ['password'] },
  });
  if (!member) {
    throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
  }
  return member;
}

export async function updateMemberStatus(
  id: string,
  member_status: 'active' | 'frozen'
): Promise<InstanceType<typeof Member>> {
  const member = await Member.findByPk(id);
  if (!member) {
    throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
  }
  member.member_status = member_status;
  await member.save();
  return member;
}

export async function adjustScore(
  id: string,
  operatorId: string,
  data: { change_type: 'growth' | 'points'; change_value: number; remark?: string }
): Promise<InstanceType<typeof ScoreDetail>> {
  const member = await Member.findByPk(id);
  if (!member) {
    throw Object.assign(new Error('Member not found'), { code: 1004, statusCode: 404 });
  }

  return sequelize.transaction(async (t) => {
    let balanceAfter: number;
    if (data.change_type === 'growth') {
      member.growth_value = member.growth_value + data.change_value;
      if (member.growth_value < 0) member.growth_value = 0;
      balanceAfter = member.growth_value;
    } else {
      member.points = member.points + data.change_value;
      if (member.points < 0) member.points = 0;
      balanceAfter = member.points;
    }
    await member.save({ transaction: t });

    const detail = await ScoreDetail.create(
      {
        detail_id: generateId(),
        member_id: id,
        change_type: data.change_type,
        change_value: data.change_value,
        source_type: 'admin_adjust',
        source_id: operatorId,
        balance_after: balanceAfter,
        remark: data.remark || null,
      },
      { transaction: t }
    );

    return detail;
  });
}
