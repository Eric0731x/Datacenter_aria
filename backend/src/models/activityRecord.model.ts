import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export type AuditStatus = 'pending' | 'approved' | 'rejected';

export interface ActivityRecordAttributes {
  record_id: string;
  member_id: string;
  activity_id: string;
  submit_time: Date;
  submit_content: string | null;
  audit_status: AuditStatus;
  audit_remark: string | null;
  auditor_id: string | null;
  audit_time: Date | null;
}

export interface ActivityRecordCreationAttributes
  extends Optional<
    ActivityRecordAttributes,
    'submit_content' | 'audit_status' | 'audit_remark' | 'auditor_id' | 'audit_time' | 'submit_time'
  > {}

class ActivityRecord
  extends Model<ActivityRecordAttributes, ActivityRecordCreationAttributes>
  implements ActivityRecordAttributes
{
  public record_id!: string;
  public member_id!: string;
  public activity_id!: string;
  public submit_time!: Date;
  public submit_content!: string | null;
  public audit_status!: AuditStatus;
  public audit_remark!: string | null;
  public auditor_id!: string | null;
  public audit_time!: Date | null;
}

ActivityRecord.init(
  {
    record_id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    member_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    activity_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    submit_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    submit_content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    audit_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    audit_remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    auditor_id: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    audit_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'activity_record',
    timestamps: false,
    indexes: [
      {
        unique: true,
        name: 'uk_member_activity',
        fields: ['member_id', 'activity_id'],
      },
    ],
  }
);

export default ActivityRecord;
