import { Benefit } from '../models';
import { generateId } from '../utils/uuid';

export interface CreateBenefitInput {
  benefit_name: string;
  description?: string | null;
  image_url?: string | null;
  benefit_type: 'virtual' | 'physical';
  pool_type: 'level' | 'exchange';
  points_cost?: number;
  level_code?: string | null;
  stock: number;
  per_limit?: number;
}

export async function listExchangeBenefits(): Promise<InstanceType<typeof Benefit>[]> {
  return Benefit.findAll({
    where: {
      pool_type: 'exchange',
      benefit_status: 'on',
    },
    order: [['create_time', 'DESC']],
  });
}

export async function getLevelBenefits(levelCode: string): Promise<InstanceType<typeof Benefit>[]> {
  return Benefit.findAll({
    where: {
      pool_type: 'level',
      level_code: levelCode,
      benefit_status: 'on',
    },
    order: [['create_time', 'DESC']],
  });
}

export async function getBenefit(id: string): Promise<InstanceType<typeof Benefit>> {
  const benefit = await Benefit.findByPk(id);
  if (!benefit) {
    throw Object.assign(new Error('Benefit not found'), { code: 1004, statusCode: 404 });
  }
  return benefit;
}

export async function createBenefit(
  input: CreateBenefitInput
): Promise<InstanceType<typeof Benefit>> {
  const benefit = await Benefit.create({
    benefit_id: generateId(),
    benefit_name: input.benefit_name,
    description: input.description || null,
    image_url: input.image_url || null,
    benefit_type: input.benefit_type,
    pool_type: input.pool_type,
    points_cost: input.points_cost || 0,
    level_code: input.level_code || null,
    stock: input.stock,
    per_limit: input.per_limit || 1,
    benefit_status: 'on',
  });
  return benefit;
}

export async function updateBenefit(
  id: string,
  input: Partial<CreateBenefitInput>
): Promise<InstanceType<typeof Benefit>> {
  const benefit = await Benefit.findByPk(id);
  if (!benefit) {
    throw Object.assign(new Error('Benefit not found'), { code: 1004, statusCode: 404 });
  }

  if (input.benefit_name !== undefined) benefit.benefit_name = input.benefit_name;
  if (input.description !== undefined) benefit.description = input.description || null;
  if (input.image_url !== undefined) benefit.image_url = input.image_url || null;
  if (input.benefit_type !== undefined) benefit.benefit_type = input.benefit_type;
  if (input.pool_type !== undefined) benefit.pool_type = input.pool_type;
  if (input.points_cost !== undefined) benefit.points_cost = input.points_cost;
  if (input.level_code !== undefined) benefit.level_code = input.level_code || null;
  if (input.stock !== undefined) benefit.stock = input.stock;
  if (input.per_limit !== undefined) benefit.per_limit = input.per_limit;

  await benefit.save();
  return benefit;
}

export async function updateBenefitStatus(
  id: string,
  status: 'on' | 'off'
): Promise<InstanceType<typeof Benefit>> {
  const benefit = await Benefit.findByPk(id);
  if (!benefit) {
    throw Object.assign(new Error('Benefit not found'), { code: 1004, statusCode: 404 });
  }
  benefit.benefit_status = status;
  await benefit.save();
  return benefit;
}
