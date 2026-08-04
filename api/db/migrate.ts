import { pool } from './pool.js'

/**
 * 建表与初始化数据，幂等执行。
 */
export async function migrate(): Promise<void> {
  const client = await pool.connect()
  try {
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

    const initialToken = process.env.INITIAL_DEVICE_TOKEN || 'esp32-default-token'
    await client.query(
      `INSERT INTO app_settings(key, value) VALUES ('device_token', $1)
       ON CONFLICT (key) DO NOTHING;`,
      [initialToken],
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
