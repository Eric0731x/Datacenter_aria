-- AI Community Membership System - Seed Data
-- Run after schema.sql

USE ai_community;

-- Level rules seed data
INSERT INTO `level_rule` (`level_code`, `level_name`, `level_threshold`, `level_benefit_desc`, `display_order`)
VALUES
  ('L1', 'Bronze',   0,    'Access to basic community resources', 1),
  ('L2', 'Silver',   100,  'Access to exclusive content and member discounts', 2),
  ('L3', 'Gold',     500,  'Priority event registration and dedicated support', 3),
  ('L4', 'Platinum', 2000, 'VIP event invitations and mentorship opportunities', 4),
  ('L5', 'Diamond',  5000, 'All benefits plus exclusive community leadership role', 5)
ON DUPLICATE KEY UPDATE
  `level_name`        = VALUES(`level_name`),
  `level_threshold`   = VALUES(`level_threshold`),
  `level_benefit_desc`= VALUES(`level_benefit_desc`),
  `display_order`     = VALUES(`display_order`);

-- Sample admin account (password: Admin@123456 — change before production!)
-- bcrypt hash for 'Admin@123456' with 10 rounds
INSERT IGNORE INTO `member`
  (`member_id`, `email`, `phone`, `nickname`, `password`, `role`, `member_level`, `growth_value`, `points`, `member_status`, `register_time`)
VALUES
  (
    'admin000000000000000000000000001',
    'admin@example.com',
    NULL,
    'System Admin',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: "password" (demo only)
    'admin',
    'L1',
    0,
    0,
    'active',
    NOW()
  );

-- Sample operator account (password same demo hash — change before production!)
INSERT IGNORE INTO `member`
  (`member_id`, `email`, `phone`, `nickname`, `password`, `role`, `member_level`, `growth_value`, `points`, `member_status`, `register_time`)
VALUES
  (
    'oper0000000000000000000000000001',
    'operator@example.com',
    NULL,
    'Community Operator',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'operator',
    'L1',
    0,
    0,
    'active',
    NOW()
  );

-- Sample benefits
INSERT IGNORE INTO `benefit`
  (`benefit_id`, `benefit_name`, `description`, `image_url`, `benefit_type`, `pool_type`, `points_cost`, `level_code`, `stock`, `per_limit`, `benefit_status`, `create_time`)
VALUES
  (
    'ben0000000000000000000000000001',
    'Community Sticker Pack',
    'Exclusive digital sticker pack for Silver members',
    NULL,
    'virtual',
    'level',
    0,
    'L2',
    9999,
    1,
    'on',
    NOW()
  ),
  (
    'ben0000000000000000000000000002',
    'AI Community T-Shirt',
    'Limited edition community T-shirt for Gold members',
    NULL,
    'physical',
    'level',
    0,
    'L3',
    100,
    1,
    'on',
    NOW()
  ),
  (
    'ben0000000000000000000000000003',
    'Premium Course Coupon',
    'Redeem for a free premium AI course',
    NULL,
    'virtual',
    'exchange',
    200,
    NULL,
    500,
    2,
    'on',
    NOW()
  ),
  (
    'ben0000000000000000000000000004',
    'Community Hoodie',
    'Cozy community branded hoodie',
    NULL,
    'physical',
    'exchange',
    500,
    NULL,
    50,
    1,
    'on',
    NOW()
  );
