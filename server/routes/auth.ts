/**
 * 管理员认证路由
 * 账号密码存于数据库 users 表，密码使用 pgcrypto bcrypt 哈希。
 */
import { Router, type Request, type Response } from 'express'
import { signToken } from '../middleware/authJwt.js'
import { pool } from '../db/pool.js'

const router = Router()

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body || {}
    if (!username || !password) {
      res.status(400).json({ ok: false, error: '请输入账号和密码' })
      return
    }
    try {
      // 利用 pgcrypto 的 crypt() 校验：crypt(输入, 已存哈希) = 已存哈希
      const { rows } = await pool.query(
        `SELECT id, username, role
         FROM users
         WHERE username = $1
           AND password_hash = crypt($2, password_hash)`,
        [String(username).trim(), String(password)],
      )
      if (!rows.length) {
        res.status(401).json({ ok: false, error: '账号或密码错误' })
        return
      }
      const user = rows[0]
      const token = signToken(user.username, user.role)
      res.json({ ok: true, token, username: user.username, role: user.role })
    } catch (e) {
      console.error('[auth] login failed', e)
      res.status(500).json({ ok: false, error: '登录失败，请检查数据库连接' })
    }
  },
)

export default router
