import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ChangeType = 'growth' | 'points';
export type SourceType = 'activity' | 'exchange' | 'admin_adjust';

export interface ScoreDetailAttributes {
  detail_id: string;
  member_id: string;
  change_type: ChangeType;
  change_value: number;
  source_type: SourceType;
  source_id: string | null;
  balance_after: number;
  create_time: Date;
  remark: string | null;
}

export interface ScoreDetailCreationAttributes
  extends Optional<ScoreDetailAttributes, 'source_id' | 'create_time' | 'remark'> {}

class ScoreDetail
  extends Model<ScoreDetailAttributes, ScoreDetailCreationAttributes>
  implements ScoreDetailAttributes
{
  public detail_id!: string;
  public member_id!: string;
  public change_type!: ChangeType;
  public change_value!: number;
  public source_type!: SourceType;
  public source_id!: string | null;
  public balance_after!: number;
  public create_time!: Date;
  public remark!: string | null;
}

ScoreDetail.init(
  {
    detail_id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    member_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    change_type: {
      type: DataTypes.ENUM('growth', 'points'),
      allowNull: false,
    },
    change_value: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    source_type: {
      type: DataTypes.ENUM('activity', 'exchange', 'admin_adjust'),
      allowNull: false,
    },
    source_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'score_detail',
    timestamps: false,
  }
);

export default ScoreDetail;
