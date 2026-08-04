/**
 * 系统设置路由（JWT 鉴权）
 */
import { Router, type Request, type Response } from 'express'
import { authJwt } from '../middleware/authJwt.js'
import {
  getDeviceToken,
  updateDeviceToken,
  listDevices,
  maskToken,
} from '../services/settingsService.js'

const router = Router()

router.use(authJwt)

/** GET /api/settings/token —— 脱敏查看当前设备 Token */
router.get('/token', async (_req: Request, res: Response): Promise<void> => {
  const t = await getDeviceToken()
  res.json({
    ok: true,
    data: {
      token_masked: maskToken(t.value),
      updated_at: t.updated_at,
    },
  })
})

/** PUT /api/settings/token —— 重置设备 Token */
router.put('/token', async (req: Request, res: Response): Promise<void> => {
  const newToken = String(req.body?.new_token || '').trim()
  if (newToken.length < 6) {
    res.status(400).json({ ok: false, error: 'Token 至少 6 个字符' })
    return
  }
  await updateDeviceToken(newToken)
  res.json({ ok: true })
})

/** GET /api/settings/devices —— 已接入设备列表 */
router.get('/devices', async (_req: Request, res: Response): Promise<void> => {
  const devices = await listDevices()
  res.json({ ok: true, data: devices })
})

export default router
