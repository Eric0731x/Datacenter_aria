import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export type BenefitType = 'virtual' | 'physical';
export type PoolType = 'level' | 'exchange';
export type BenefitStatus = 'on' | 'off';

export interface BenefitAttributes {
  benefit_id: string;
  benefit_name: string;
  description: string | null;
  image_url: string | null;
  benefit_type: BenefitType;
  pool_type: PoolType;
  points_cost: number;
  level_code: string | null;
  stock: number;
  per_limit: number;
  benefit_status: BenefitStatus;
  create_time: Date;
}

export interface BenefitCreationAttributes
  extends Optional<
    BenefitAttributes,
    'description' | 'image_url' | 'points_cost' | 'level_code' | 'per_limit' | 'benefit_status' | 'create_time'
  > {}

class Benefit
  extends Model<BenefitAttributes, BenefitCreationAttributes>
  implements BenefitAttributes
{
  public benefit_id!: string;
  public benefit_name!: string;
  public description!: string | null;
  public image_url!: string | null;
  public benefit_type!: BenefitType;
  public pool_type!: PoolType;
  public points_cost!: number;
  public level_code!: string | null;
  public stock!: number;
  public per_limit!: number;
  public benefit_status!: BenefitStatus;
  public create_time!: Date;
}

Benefit.init(
  {
    benefit_id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    benefit_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    benefit_type: {
      type: DataTypes.ENUM('virtual', 'physical'),
      allowNull: false,
    },
    pool_type: {
      type: DataTypes.ENUM('level', 'exchange'),
      allowNull: false,
    },
    points_cost: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    level_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    per_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    benefit_status: {
      type: DataTypes.ENUM('on', 'off'),
      allowNull: false,
      defaultValue: 'on',
    },
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'benefit',
    timestamps: false,
  }
);

export default Benefit;
