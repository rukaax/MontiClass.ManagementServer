import { randomBytes } from 'crypto'
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

/** 生成加密安全的随机 Token */
export function generateRandomToken(): string {
  return `esp32-${randomBytes(24).toString('base64url')}`
}

/** 随机生成并保存新 Token，返回明文（仅此一次返回给调用方） */
export async function rotateDeviceToken(): Promise<string> {
  const newToken = generateRandomToken()
  await pool.query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES ('device_token', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [newToken],
  )
  return newToken
}

/** 修改管理员密码：校验当前密码，通过则更新为新密码的 bcrypt 哈希 */
export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM users
     WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
    [username, currentPassword],
  )
  if (!rows.length) return false
  await pool.query(
    `UPDATE users
     SET password_hash = crypt($1, gen_salt('bf', 10)), updated_at = NOW()
     WHERE username = $2`,
    [newPassword, username],
  )
  return true
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
