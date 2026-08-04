import { pool } from './pool.js'

/**
 * 建表与初始化数据，幂等执行。
 * 管理员密码使用 PostgreSQL pgcrypto 扩展的 crypt() + gen_salt('bf') 做 bcrypt 哈希。
 */
export async function migrate(): Promise<void> {
  const client = await pool.connect()
  try {
    // pgcrypto：提供 crypt / gen_salt 用于密码哈希
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS device_reports (
        id           BIGSERIAL PRIMARY KEY,
        device_id    VARCHAR(64)  NOT NULL,
        light1       INTEGER,
        light2       INTEGER,
        aqi          INTEGER,
        temperature  NUMERIC(5,2),
        speed        NUMERIC(5,2),
        presence     BOOLEAN,
        reported_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        received_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `)
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_reports_device_id   ON device_reports(device_id);`,
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_reports_reported_at ON device_reports(reported_at DESC);`,
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_reports_device_time ON device_reports(device_id, reported_at DESC);`,
    )

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key         VARCHAR(64) PRIMARY KEY,
        value       TEXT        NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            BIGSERIAL    PRIMARY KEY,
        username      VARCHAR(64)  NOT NULL UNIQUE,
        password_hash TEXT         NOT NULL,
        role          VARCHAR(16)  NOT NULL DEFAULT 'admin',
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `)

    // 初始化设备上报 Token
    const initialToken = process.env.INITIAL_DEVICE_TOKEN || 'esp32-default-token'
    await client.query(
      `INSERT INTO app_settings(key, value) VALUES ('device_token', $1)
       ON CONFLICT (key) DO NOTHING;`,
      [initialToken],
    )

    // 初始化默认管理员 admin / admin（bcrypt 哈希存储）
    await client.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ('admin', crypt('admin', gen_salt('bf', 10)), 'admin')
       ON CONFLICT (username) DO NOTHING;`,
    )

    console.log('[db] schema migrated')
  } finally {
    client.release()
  }
}

let initPromise: Promise<void> | null = null
export function ensureSchema(): Promise<void> {
  if (!initPromise) {
    initPromise = migrate().catch((e) => {
      initPromise = null
      throw e
    })
  }
  return initPromise
}
