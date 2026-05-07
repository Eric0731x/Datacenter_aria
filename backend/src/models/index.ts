import sequelize from '../config/database';
import Member from './member.model';
import Activity from './activity.model';
import ActivityRecord from './activityRecord.model';
import Benefit from './benefit.model';
import ExchangeOrder from './exchangeOrder.model';
import LevelRule from './levelRule.model';
import ScoreDetail from './scoreDetail.model';

// Define associations
Member.hasMany(Activity, { foreignKey: 'creator_id', as: 'createdActivities' });
Activity.belongsTo(Member, { foreignKey: 'creator_id', as: 'creator' });

Member.hasMany(ActivityRecord, { foreignKey: 'member_id', as: 'activityRecords' });
ActivityRecord.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

Activity.hasMany(ActivityRecord, { foreignKey: 'activity_id', as: 'records' });
ActivityRecord.belongsTo(Activity, { foreignKey: 'activity_id', as: 'activity' });

Member.hasMany(ExchangeOrder, { foreignKey: 'member_id', as: 'orders' });
ExchangeOrder.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

Benefit.hasMany(ExchangeOrder, { foreignKey: 'benefit_id', as: 'orders' });
ExchangeOrder.belongsTo(Benefit, { foreignKey: 'benefit_id', as: 'benefit' });

Member.hasMany(ScoreDetail, { foreignKey: 'member_id', as: 'scoreDetails' });
ScoreDetail.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

export {
  sequelize,
  Member,
  Activity,
  ActivityRecord,
  Benefit,
  ExchangeOrder,
  LevelRule,
  ScoreDetail,
};
