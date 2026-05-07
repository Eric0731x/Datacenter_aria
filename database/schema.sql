-- AI Community Membership System - Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS ai_community
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_community;

-- 1. Member table
CREATE TABLE IF NOT EXISTS `member` (
  `member_id`     VARCHAR(32) NOT NULL COMMENT 'UUID without dashes',
  `email`         VARCHAR(255) NOT NULL,
  `phone`         VARCHAR(20) DEFAULT NULL,
  `nickname`      VARCHAR(100) NOT NULL,
  `password`      VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  `role`          ENUM('member','mentor','operator','admin') NOT NULL DEFAULT 'member',
  `member_level`  ENUM('L1','L2','L3','L4','L5') NOT NULL DEFAULT 'L1',
  `growth_value`  INT NOT NULL DEFAULT 0,
  `points`        INT NOT NULL DEFAULT 0,
  `member_status` ENUM('active','frozen') NOT NULL DEFAULT 'active',
  `register_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`member_id`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `idx_member_status` (`member_status`),
  KEY `idx_member_level` (`member_level`),
  KEY `idx_register_time` (`register_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Community members';

-- 2. Activity table
CREATE TABLE IF NOT EXISTS `activity` (
  `activity_id`     VARCHAR(32) NOT NULL,
  `title`           VARCHAR(200) NOT NULL,
  `description`     TEXT DEFAULT NULL,
  `activity_type`   ENUM('checkin','cobuilding','sharing','submission','qa') NOT NULL,
  `settle_mode`     ENUM('auto','audit') NOT NULL,
  `growth_reward`   INT NOT NULL DEFAULT 0,
  `points_reward`   INT NOT NULL DEFAULT 0,
  `start_time`      DATETIME NOT NULL,
  `end_time`        DATETIME NOT NULL,
  `creator_id`      VARCHAR(32) NOT NULL,
  `activity_status` ENUM('pending','active','ended','rejected') NOT NULL DEFAULT 'pending',
  `create_time`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`activity_id`),
  KEY `idx_activity_status` (`activity_status`),
  KEY `idx_activity_type` (`activity_type`),
  KEY `idx_creator_id` (`creator_id`),
  KEY `idx_create_time` (`create_time`),
  CONSTRAINT `fk_activity_creator` FOREIGN KEY (`creator_id`) REFERENCES `member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Community activities';

-- 3. Activity record table
CREATE TABLE IF NOT EXISTS `activity_record` (
  `record_id`      VARCHAR(32) NOT NULL,
  `member_id`      VARCHAR(32) NOT NULL,
  `activity_id`    VARCHAR(32) NOT NULL,
  `submit_time`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `submit_content` TEXT DEFAULT NULL,
  `audit_status`   ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `audit_remark`   TEXT DEFAULT NULL,
  `auditor_id`     VARCHAR(32) DEFAULT NULL,
  `audit_time`     DATETIME DEFAULT NULL,
  PRIMARY KEY (`record_id`),
  UNIQUE KEY `uk_member_activity` (`member_id`, `activity_id`),
  KEY `idx_audit_status` (`audit_status`),
  KEY `idx_submit_time` (`submit_time`),
  KEY `idx_activity_id` (`activity_id`),
  CONSTRAINT `fk_record_member` FOREIGN KEY (`member_id`) REFERENCES `member` (`member_id`),
  CONSTRAINT `fk_record_activity` FOREIGN KEY (`activity_id`) REFERENCES `activity` (`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Activity participation records';

-- 4. Benefit table
CREATE TABLE IF NOT EXISTS `benefit` (
  `benefit_id`     VARCHAR(32) NOT NULL,
  `benefit_name`   VARCHAR(200) NOT NULL,
  `description`    TEXT DEFAULT NULL,
  `image_url`      VARCHAR(500) DEFAULT NULL,
  `benefit_type`   ENUM('virtual','physical') NOT NULL,
  `pool_type`      ENUM('level','exchange') NOT NULL,
  `points_cost`    INT NOT NULL DEFAULT 0,
  `level_code`     VARCHAR(10) DEFAULT NULL,
  `stock`          INT NOT NULL DEFAULT 0,
  `per_limit`      INT NOT NULL DEFAULT 1,
  `benefit_status` ENUM('on','off') NOT NULL DEFAULT 'on',
  `create_time`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`benefit_id`),
  KEY `idx_pool_type` (`pool_type`),
  KEY `idx_benefit_status` (`benefit_status`),
  KEY `idx_level_code` (`level_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Member benefits';

-- 5. Exchange order table
CREATE TABLE IF NOT EXISTS `exchange_order` (
  `order_id`        VARCHAR(32) NOT NULL,
  `member_id`       VARCHAR(32) NOT NULL,
  `benefit_id`      VARCHAR(32) NOT NULL,
  `benefit_type`    VARCHAR(20) NOT NULL,
  `source`          ENUM('level_grant','points_exchange') NOT NULL,
  `points_cost`     INT NOT NULL DEFAULT 0,
  `create_time`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `redeem_code`     TEXT DEFAULT NULL COMMENT 'AES-256-CBC encrypted',
  `shipping_name`   VARCHAR(100) DEFAULT NULL,
  `shipping_phone`  TEXT DEFAULT NULL COMMENT 'AES-256-CBC encrypted',
  `shipping_address` TEXT DEFAULT NULL COMMENT 'AES-256-CBC encrypted',
  `order_status`    ENUM('pending','shipped','delivered') NOT NULL DEFAULT 'pending',
  `tracking_no`     VARCHAR(100) DEFAULT NULL,
  `ship_time`       DATETIME DEFAULT NULL,
  `deliver_time`    DATETIME DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `idx_member_id` (`member_id`),
  KEY `idx_benefit_id` (`benefit_id`),
  KEY `idx_order_status` (`order_status`),
  KEY `idx_create_time` (`create_time`),
  CONSTRAINT `fk_order_member` FOREIGN KEY (`member_id`) REFERENCES `member` (`member_id`),
  CONSTRAINT `fk_order_benefit` FOREIGN KEY (`benefit_id`) REFERENCES `benefit` (`benefit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Benefit exchange orders';

-- 6. Level rule table
CREATE TABLE IF NOT EXISTS `level_rule` (
  `level_code`        VARCHAR(10) NOT NULL,
  `level_name`        VARCHAR(50) NOT NULL,
  `level_threshold`   INT NOT NULL DEFAULT 0,
  `level_benefit_desc` TEXT DEFAULT NULL,
  `display_order`     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`level_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Member level rules';

-- 7. Score detail table
CREATE TABLE IF NOT EXISTS `score_detail` (
  `detail_id`    VARCHAR(32) NOT NULL,
  `member_id`    VARCHAR(32) NOT NULL,
  `change_type`  ENUM('growth','points') NOT NULL,
  `change_value` INT NOT NULL,
  `source_type`  ENUM('activity','exchange','admin_adjust') NOT NULL,
  `source_id`    VARCHAR(32) DEFAULT NULL,
  `balance_after` INT NOT NULL,
  `create_time`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `remark`       TEXT DEFAULT NULL,
  PRIMARY KEY (`detail_id`),
  KEY `idx_member_id` (`member_id`),
  KEY `idx_change_type` (`change_type`),
  KEY `idx_source_type` (`source_type`),
  KEY `idx_create_time` (`create_time`),
  CONSTRAINT `fk_score_member` FOREIGN KEY (`member_id`) REFERENCES `member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Score change details';
