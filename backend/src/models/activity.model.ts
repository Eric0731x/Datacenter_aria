import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ActivityType = 'checkin' | 'cobuilding' | 'sharing' | 'submission' | 'qa';
export type SettleMode = 'auto' | 'audit';
export type ActivityStatus = 'pending' | 'active' | 'ended' | 'rejected';

export interface ActivityAttributes {
  activity_id: string;
  title: string;
  description: string | null;
  activity_type: ActivityType;
  settle_mode: SettleMode;
  growth_reward: number;
  points_reward: number;
  start_time: Date;
  end_time: Date;
  creator_id: string;
  activity_status: ActivityStatus;
  create_time: Date;
}

export interface ActivityCreationAttributes
  extends Optional<ActivityAttributes, 'description' | 'activity_status' | 'create_time'> {}

class Activity
  extends Model<ActivityAttributes, ActivityCreationAttributes>
  implements ActivityAttributes
{
  public activity_id!: string;
  public title!: string;
  public description!: string | null;
  public activity_type!: ActivityType;
  public settle_mode!: SettleMode;
  public growth_reward!: number;
  public points_reward!: number;
  public start_time!: Date;
  public end_time!: Date;
  public creator_id!: string;
  public activity_status!: ActivityStatus;
  public create_time!: Date;
}

Activity.init(
  {
    activity_id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    activity_type: {
      type: DataTypes.ENUM('checkin', 'cobuilding', 'sharing', 'submission', 'qa'),
      allowNull: false,
    },
    settle_mode: {
      type: DataTypes.ENUM('auto', 'audit'),
      allowNull: false,
    },
    growth_reward: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    points_reward: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    creator_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    activity_status: {
      type: DataTypes.ENUM('pending', 'active', 'ended', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'activity',
    timestamps: false,
  }
);

export default Activity;
