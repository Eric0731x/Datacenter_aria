import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export type MemberRole = 'member' | 'mentor' | 'operator' | 'admin';
export type MemberLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export type MemberStatus = 'active' | 'frozen';

export interface MemberAttributes {
  member_id: string;
  email: string;
  phone: string | null;
  nickname: string;
  password: string;
  role: MemberRole;
  member_level: MemberLevel;
  growth_value: number;
  points: number;
  member_status: MemberStatus;
  register_time: Date;
}

export interface MemberCreationAttributes
  extends Optional<
    MemberAttributes,
    'phone' | 'role' | 'member_level' | 'growth_value' | 'points' | 'member_status' | 'register_time'
  > {}

class Member
  extends Model<MemberAttributes, MemberCreationAttributes>
  implements MemberAttributes
{
  public member_id!: string;
  public email!: string;
  public phone!: string | null;
  public nickname!: string;
  public password!: string;
  public role!: MemberRole;
  public member_level!: MemberLevel;
  public growth_value!: number;
  public points!: number;
  public member_status!: MemberStatus;
  public register_time!: Date;
}

Member.init(
  {
    member_id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    nickname: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('member', 'mentor', 'operator', 'admin'),
      allowNull: false,
      defaultValue: 'member',
    },
    member_level: {
      type: DataTypes.ENUM('L1', 'L2', 'L3', 'L4', 'L5'),
      allowNull: false,
      defaultValue: 'L1',
    },
    growth_value: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    points: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    member_status: {
      type: DataTypes.ENUM('active', 'frozen'),
      allowNull: false,
      defaultValue: 'active',
    },
    register_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'member',
    timestamps: false,
  }
);

export default Member;
