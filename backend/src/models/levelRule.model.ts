import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface LevelRuleAttributes {
  level_code: string;
  level_name: string;
  level_threshold: number;
  level_benefit_desc: string | null;
  display_order: number;
}

export interface LevelRuleCreationAttributes
  extends Optional<LevelRuleAttributes, 'level_benefit_desc'> {}

class LevelRule
  extends Model<LevelRuleAttributes, LevelRuleCreationAttributes>
  implements LevelRuleAttributes
{
  public level_code!: string;
  public level_name!: string;
  public level_threshold!: number;
  public level_benefit_desc!: string | null;
  public display_order!: number;
}

LevelRule.init(
  {
    level_code: {
      type: DataTypes.STRING(10),
      primaryKey: true,
      allowNull: false,
    },
    level_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    level_threshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    level_benefit_desc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'level_rule',
    timestamps: false,
  }
);

export default LevelRule;
