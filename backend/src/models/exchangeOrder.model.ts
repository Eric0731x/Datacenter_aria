import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export type OrderSource = 'level_grant' | 'points_exchange';
export type OrderStatus = 'pending' | 'shipped' | 'delivered';

export interface ExchangeOrderAttributes {
  order_id: string;
  member_id: string;
  benefit_id: string;
  benefit_type: string;
  source: OrderSource;
  points_cost: number;
  create_time: Date;
  redeem_code: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  order_status: OrderStatus;
  tracking_no: string | null;
  ship_time: Date | null;
  deliver_time: Date | null;
}

export interface ExchangeOrderCreationAttributes
  extends Optional<
    ExchangeOrderAttributes,
    | 'points_cost'
    | 'create_time'
    | 'redeem_code'
    | 'shipping_name'
    | 'shipping_phone'
    | 'shipping_address'
    | 'order_status'
    | 'tracking_no'
    | 'ship_time'
    | 'deliver_time'
  > {}

class ExchangeOrder
  extends Model<ExchangeOrderAttributes, ExchangeOrderCreationAttributes>
  implements ExchangeOrderAttributes
{
  public order_id!: string;
  public member_id!: string;
  public benefit_id!: string;
  public benefit_type!: string;
  public source!: OrderSource;
  public points_cost!: number;
  public create_time!: Date;
  public redeem_code!: string | null;
  public shipping_name!: string | null;
  public shipping_phone!: string | null;
  public shipping_address!: string | null;
  public order_status!: OrderStatus;
  public tracking_no!: string | null;
  public ship_time!: Date | null;
  public deliver_time!: Date | null;
}

ExchangeOrder.init(
  {
    order_id: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    member_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    benefit_id: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    benefit_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM('level_grant', 'points_exchange'),
      allowNull: false,
    },
    points_cost: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    create_time: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    redeem_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shipping_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    shipping_phone: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shipping_address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    order_status: {
      type: DataTypes.ENUM('pending', 'shipped', 'delivered'),
      allowNull: false,
      defaultValue: 'pending',
    },
    tracking_no: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ship_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliver_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'exchange_order',
    timestamps: false,
  }
);

export default ExchangeOrder;
