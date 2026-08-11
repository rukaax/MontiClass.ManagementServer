import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export interface UserPayload {
  sub: string
  role: 'admin' | 'viewer'
}

/** 验证 JWT，不校验角色，将 payload 挂载到 req.admin */
export function authJwt(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }
  try {
    const payload = jwt.verify(token, SECRET) as UserPayload
    ;(req as Request & { admin?: UserPayload }).admin = payload
    next()
  } catch {
    res.status(401).json({ ok: false, error: 'invalid token' })
  }
}

/** 要求管理员角色，需在 authJwt 之后使用 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as Request & { admin?: UserPayload }).admin
  if (!user || user.role !== 'admin') {
    res.status(403).json({ ok: false, error: '仅管理员可操作' })
    return
  }
  next()
}

export function signToken(username: string, role: 'admin' | 'viewer'): string {
  return jwt.sign({ sub: username, role }, SECRET, { expiresIn: '12h' })
}