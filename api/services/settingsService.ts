import { pool } from '../db/pool.js'

export async function getDeviceToken(): Promise<{
  value: string
  updated_at: string | null
}> {
  const { rows } = await pool.query(
    `SELECT value, updated_at FROM app_settings WHERE key = 'device_token'`,
  )
  return rows[0] ?? { value: '', updated_at: null }
}

export async function updateDeviceToken(newToken: string): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES ('device_token', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [newToken],
  )
}

export async function listDevices(): Promise<
  { device_id: string; last_seen: string; count: number }[]
> {
  const { rows } = await pool.query(
    `SELECT device_id,
            MAX(reported_at) AS last_seen,
            COUNT(*)::int AS count
     FROM device_reports
     GROUP BY device_id
     ORDER BY last_seen DESC`,
  )
  return rows
}

export function maskToken(token: string): string {
  if (!token) return ''
  if (token.length <= 8) return '••••'
  return `${token.slice(0, 4)}${'•'.repeat(Math.max(4, token.length - 8))}${token.slice(-4)}`
}
