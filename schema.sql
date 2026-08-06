-- =====================================================================
-- ESP32S3 智能教室环境监测系统 · 数据库初始化脚本
-- ---------------------------------------------------------------------
-- 使用方法：
--   1. 先创建数据库：
--        sudo -u postgres createdb esp32_classroom
--   2. 导入本脚本：
--        sudo -u postgres psql -d esp32_classroom -f schema.sql
--      或在 psql 中连接到 esp32_classroom 后执行：
--        \i schema.sql
--
-- 说明：
--   · 管理员密码使用 pgcrypto 的 crypt() + gen_salt('bf',10) 做 bcrypt 哈希
--   · 默认管理员：admin / admin  （请登录后在数据库中修改密码，见文件末尾）
--   · 默认设备上报 Token：esp32-classroom-token-2026（可在 WEB「系统设置」页修改）
-- =====================================================================

-- pgcrypto 扩展：提供 crypt / gen_salt 用于密码哈希
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 环境数据上报表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_reports (
    id           BIGSERIAL    PRIMARY KEY,
    device_id    VARCHAR(64)  NOT NULL,
    light1       NUMERIC(5,2),                  -- 光敏1 亮度百分比 0-100
    light2       NUMERIC(5,2),                  -- 光敏2 亮度百分比 0-100
    light1_adc   INTEGER,                       -- 光敏1 ADC 原始值 0-4095
    light2_adc   INTEGER,                       -- 光敏2 ADC 原始值 0-4095
    aqi          INTEGER,                       -- 空气质量指数 0-500
    temperature  NUMERIC(5,2),                  -- 温度 ℃
    humidity     NUMERIC(5,2),                  -- 相对湿度 % 0-100
    presence     BOOLEAN,                       -- 是否有人
    reported_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    received_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 兼容旧库迁移：light1/2 转 NUMERIC、新增 ADC 列、移除 speed
ALTER TABLE device_reports ALTER COLUMN light1 TYPE NUMERIC(5,2) USING light1::numeric(5,2);
ALTER TABLE device_reports ALTER COLUMN light2 TYPE NUMERIC(5,2) USING light2::numeric(5,2);
ALTER TABLE device_reports ADD COLUMN IF NOT EXISTS light1_adc INTEGER;
ALTER TABLE device_reports ADD COLUMN IF NOT EXISTS light2_adc INTEGER;
ALTER TABLE device_reports ADD COLUMN IF NOT EXISTS humidity NUMERIC(5,2);
ALTER TABLE device_reports DROP COLUMN IF EXISTS speed;

CREATE INDEX IF NOT EXISTS idx_reports_device_id   ON device_reports(device_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON device_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_device_time ON device_reports(device_id, reported_at DESC);

-- ---------------------------------------------------------------------
-- 应用设置表（存储可热更新的设备 Token 等）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(64) PRIMARY KEY,
    value       TEXT        NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 管理员用户表（密码 bcrypt 哈希存储）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL    PRIMARY KEY,
    username      VARCHAR(64)  NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'admin',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 初始化数据
-- ---------------------------------------------------------------------

-- 设备上报 Token 初始值
INSERT INTO app_settings (key, value)
VALUES ('device_token', 'esp32-classroom-token-2026')
ON CONFLICT (key) DO NOTHING;

-- 默认管理员账号：admin / admin （密码已用 bcrypt 哈希）
INSERT INTO users (username, password_hash, role)
VALUES ('admin', crypt('admin', gen_salt('bf', 10)), 'admin')
ON CONFLICT (username) DO NOTHING;

-- =====================================================================
-- 修改管理员密码示例（取消注释并替换 '新密码' 后执行）：
--   UPDATE users SET password_hash = crypt('新密码', gen_salt('bf', 10)),
--          updated_at = NOW()
--   WHERE username = 'admin';
-- =====================================================================
