import type { Request, Response, NextFunction } from 'express'
import { getDeviceToken } from '../services/settingsService.js'

/** 校验 ESP32 设备上报用的 Bearer Token */
export async function authToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ ok: false, error: 'missing token' })
    return
  }
  const stored = await getDeviceToken()
  if (!stored.value || token !== stored.value) {
    res.status(401).json({ ok: false, error: 'invalid token' })
    return
  }
  next()
}
