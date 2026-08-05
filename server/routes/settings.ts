/**
 * 系统设置路由（JWT 鉴权）
 */
import { Router, type Request, type Response } from 'express'
import { authJwt } from '../middleware/authJwt.js'
import {
  getDeviceToken,
  updateDeviceToken,
  rotateDeviceToken,
  changePassword,
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

/** PUT /api/settings/token —— 手动设置设备 Token（自定义） */
router.put('/token', async (req: Request, res: Response): Promise<void> => {
  const newToken = String(req.body?.new_token || '').trim()
  if (newToken.length < 6) {
    res.status(400).json({ ok: false, error: 'Token 至少 6 个字符' })
    return
  }
  await updateDeviceToken(newToken)
  res.json({ ok: true })
})

/** POST /api/settings/token/rotate —— 随机生成新 Token，返回明文（仅此一次） */
router.post('/token/rotate', async (_req: Request, res: Response): Promise<void> => {
  const token = await rotateDeviceToken()
  res.json({ ok: true, data: { token } })
})

/** POST /api/settings/password —— 修改当前管理员密码 */
router.post('/password', async (req: Request, res: Response): Promise<void> => {
  const admin = (req as Request & { admin?: { sub: string } }).admin
  const username = admin?.sub || ''
  const current = String(req.body?.current_password || '')
  const next = String(req.body?.new_password || '')
  if (next.length < 6) {
    res.status(400).json({ ok: false, error: '新密码至少 6 个字符' })
    return
  }
  if (current === next) {
    res.status(400).json({ ok: false, error: '新密码不能与当前密码相同' })
    return
  }
  const ok = await changePassword(username, current, next)
  if (!ok) {
    res.status(400).json({ ok: false, error: '当前密码错误' })
    return
  }
  res.json({ ok: true })
})

/** GET /api/settings/devices —— 已接入设备列表 */
router.get('/devices', async (_req: Request, res: Response): Promise<void> => {
  const devices = await listDevices()
  res.json({ ok: true, data: devices })
})

export default router
