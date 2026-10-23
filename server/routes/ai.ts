/**
 * AI 助手路由：模型配置 + 对话
 */
import { Router, type Request, type Response } from 'express'
import { authJwt, requireAdmin, type UserPayload } from '../middleware/authJwt.js'
import {
  getAiConfigPublic,
  saveAiConfig,
  getAiConfigForUse,
  chatWithAi,
} from '../services/aiService.js'

const router = Router()

router.use(authJwt)

function currentUser(req: Request): UserPayload | undefined {
  return (req as Request & { admin?: UserPayload }).admin
}

/** GET /api/ai/config —— 查看模型配置（API Key 仅返回脱敏值） */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await getAiConfigPublic()
    res.json({ ok: true, data })
  } catch (e) {
    console.error('[ai] config read failed', e)
    res.status(500).json({ ok: false, error: '读取 AI 配置失败' })
  }
})

/** PUT /api/ai/config —— 保存模型配置（仅管理员） */
router.put(
  '/config',
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const baseUrl = String(req.body?.base_url || '').trim()
    const model = String(req.body?.model || '').trim()
    const apiKey =
      typeof req.body?.api_key === 'string' ? req.body.api_key.trim() : ''

    if (!baseUrl || !model) {
      res.status(400).json({ ok: false, error: 'Base URL 与模型名称不能为空' })
      return
    }
    try {
      const u = new URL(baseUrl)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        res.status(400).json({ ok: false, error: 'Base URL 必须以 http:// 或 https:// 开头' })
        return
      }
    } catch {
      res.status(400).json({ ok: false, error: 'Base URL 格式不正确' })
      return
    }

    try {
      const current = await getAiConfigPublic()
      if (!apiKey && !current.has_key) {
        res.status(400).json({ ok: false, error: '首次配置必须填写 API Key' })
        return
      }
      await saveAiConfig({ base_url: baseUrl, model, api_key: apiKey })
      const data = await getAiConfigPublic()
      res.json({ ok: true, data })
    } catch (e) {
      console.error('[ai] config save failed', e)
      res.status(500).json({ ok: false, error: '保存 AI 配置失败' })
    }
  },
)

/** POST /api/ai/chat —— AI 对话（仅管理员可获得控制工具） */
router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const user = currentUser(req)
  const canControl = user?.role === 'admin'
  try {
    const cfg = await getAiConfigForUse()
    const message = await chatWithAi(
      cfg,
      req.body?.messages,
      req.body?.state,
      canControl,
    )
    res.json({ ok: true, data: { message } })
  } catch (e: any) {
    console.error('[ai] chat failed', e?.message || e)
    res.status(502).json({ ok: false, error: e?.message || 'AI 对话失败' })
  }
})

export default router
