/**
 * 管理员认证路由
 */
import { Router, type Request, type Response } from 'express'
import { signAdminToken } from '../middleware/authJwt.js'

const router = Router()

const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'changeme'

/**
 * POST /api/auth/login
 */
router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    res.status(400).json({ ok: false, error: '请输入账号和密码' })
    return
  }
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    res.status(401).json({ ok: false, error: '账号或密码错误' })
    return
  }
  const token = signAdminToken(username)
  res.json({ ok: true, token, username })
})

export default router
