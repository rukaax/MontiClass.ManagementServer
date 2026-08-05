/**
 * Vercel serverless 入口：冷启动时自动建表/初始化，再把请求交给 Express app
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import app from '../server/app.js'
import { ensureSchema } from '../server/db/migrate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 冷启动执行一次（幂等）：建表 + 初始设备 Token + 默认管理员 admin/admin
  try {
    await ensureSchema()
  } catch (e) {
    console.error('[db] cold-start migrate failed:', e)
  }
  return app(req, res)
}
