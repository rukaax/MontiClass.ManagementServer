import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export interface AdminPayload {
  sub: string
  role: 'admin'
}

/** 校验管理员 JWT */
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
    const payload = jwt.verify(token, SECRET) as AdminPayload
    if (payload.role !== 'admin') throw new Error('not admin')
    ;(req as Request & { admin?: AdminPayload }).admin = payload
    next()
  } catch {
    res.status(401).json({ ok: false, error: 'invalid token' })
  }
}

export function signAdminToken(username: string): string {
  return jwt.sign({ sub: username, role: 'admin' }, SECRET, {
    expiresIn: '12h',
  })
}
