/**
 * API 服务
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth.js'
import reportsRoutes from './routes/reports.js'
import settingsRoutes from './routes/settings.js'
import aiRoutes from './routes/ai.js'

dotenv.config()

const app: express.Application = express()

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true)
      else cb(null, true) // 本地开发放开，生产请改为 cb(new Error('Not allowed'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/ai', aiRoutes)

/** 健康检查 */
app.use('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

/** 错误处理 */
app.use(
  (error: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('[api] error', error.message)
    res.status(500).json({ ok: false, error: 'Server internal error' })
  },
)

/** /api 404（仅作用于 API 路径，非 /api 路径交给前端 SPA） */
app.use('/api', (_req: Request, res: Response): void => {
  res.status(404).json({ ok: false, error: 'API not found' })
})

export default app
