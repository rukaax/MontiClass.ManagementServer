/**
 * 数据上报与查询路由
 */
import { Router, type Request, type Response } from 'express'
import { authToken } from '../middleware/authToken.js'
import { authJwt } from '../middleware/authJwt.js'
import {
  insertReport,
  getLatest,
  getHistory,
  getStats,
  getTimeline,
} from '../services/reportsService.js'
import type { ReportPayload } from '../types.js'

const router = Router()

/** POST /api/reports —— ESP32 设备上报（Token 鉴权） */
router.post(
  '/',
  authToken,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body || {}
    const deviceId = String(body.device_id || '').trim()
    if (!deviceId) {
      res.status(400).json({ ok: false, error: 'device_id is required' })
      return
    }

    const payload: ReportPayload = {
      device_id: deviceId,
      light1: body.light1 != null ? Number(body.light1) : null,
      light2: body.light2 != null ? Number(body.light2) : null,
      light1_adc: body.light1_adc != null ? Number(body.light1_adc) : null,
      light2_adc: body.light2_adc != null ? Number(body.light2_adc) : null,
      aqi: body.aqi != null ? Number(body.aqi) : null,
      temperature: body.temperature != null ? Number(body.temperature) : null,
      humidity: body.humidity != null ? Number(body.humidity) : null,
      presence: body.presence == null ? null : Boolean(body.presence),
      reported_at: body.reported_at || null,
    }

    try {
      const row = await insertReport(payload)
      res.status(201).json({ ok: true, id: row.id })
    } catch (e) {
      console.error('[reports] insert failed', e)
      res.status(500).json({ ok: false, error: 'insert failed' })
    }
  },
)

/** GET /api/reports/latest —— 最新一条上报（JWT） */
router.get(
  '/latest',
  authJwt,
  async (req: Request, res: Response): Promise<void> => {
    const deviceId =
      typeof req.query.device_id === 'string'
        ? String(req.query.device_id)
        : undefined
    try {
      const row = await getLatest(deviceId)
      res.json({ ok: true, data: row })
    } catch (e) {
      console.error('[reports] latest failed', e)
      res.status(500).json({ ok: false, error: 'query failed' })
    }
  },
)

/** GET /api/reports/history —— 分页历史（JWT） */
router.get(
  '/history',
  authJwt,
  async (req: Request, res: Response): Promise<void> => {
    const q = req.query
    try {
      const result = await getHistory({
        deviceId:
          typeof q.device_id === 'string' ? String(q.device_id) : undefined,
        start: typeof q.start === 'string' ? String(q.start) : undefined,
        end: typeof q.end === 'string' ? String(q.end) : undefined,
        page: q.page ? Number(q.page) : 1,
        size: q.size ? Number(q.size) : 20,
      })
      res.json({ ok: true, data: result })
    } catch (e) {
      console.error('[reports] history failed', e)
      res.status(500).json({ ok: false, error: 'query failed' })
    }
  },
)

/** GET /api/reports/stats —— 聚合统计（JWT） */
router.get(
  '/stats',
  authJwt,
  async (req: Request, res: Response): Promise<void> => {
    const q = req.query
    const metric = typeof q.metric === 'string' ? String(q.metric) : 'temperature'
    const granularity =
      typeof q.granularity === 'string' && q.granularity === 'day'
        ? 'day'
        : 'hour'
    try {
      const result = await getStats({
        deviceId:
          typeof q.device_id === 'string' ? String(q.device_id) : undefined,
        start: typeof q.start === 'string' ? String(q.start) : undefined,
        end: typeof q.end === 'string' ? String(q.end) : undefined,
        metric,
        granularity,
      })
      res.json({ ok: true, data: result })
    } catch (e) {
      console.error('[reports] stats failed', e)
      res.status(500).json({ ok: false, error: 'query failed' })
    }
  },
)

/** GET /api/reports/timeline —— 原始数据点（JWT），用于图表全量绘制 */
router.get(
  '/timeline',
  authJwt,
  async (req: Request, res: Response): Promise<void> => {
    const q = req.query
    const metric = typeof q.metric === 'string' ? String(q.metric) : 'temperature'
    try {
      const result = await getTimeline({
        deviceId:
          typeof q.device_id === 'string' ? String(q.device_id) : undefined,
        start: typeof q.start === 'string' ? String(q.start) : undefined,
        end: typeof q.end === 'string' ? String(q.end) : undefined,
        metric,
      })
      res.json({ ok: true, data: result })
    } catch (e) {
      console.error('[reports] timeline failed', e)
      res.status(500).json({ ok: false, error: 'query failed' })
    }
  },
)

export default router
