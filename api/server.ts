/**
 * 统一服务入口：API 与前端共用同一端口
 *  - 开发模式：Vite 以中间件模式挂载到 Express，保留 HMR
 *  - 生产模式：Express 托管 dist/ 静态产物 + SPA fallback
 */
import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createServer as createViteServer } from 'vite'

import app from './app.js'
import { migrate } from './db/migrate.js'
import { pool } from './db/pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 3001
const isDev = process.env.NODE_ENV !== 'production'

async function main(): Promise<void> {
  try {
    await migrate()
  } catch (e) {
    console.error('[db] 启动迁移失败，请检查 DATABASE_URL（.env）:', e)
    console.error('    服务仍将启动，但数据库相关接口会报错。')
  }

  if (isDev) {
    // 开发：Vite 中间件模式，HMR + 静态资源由 Vite 接管
    const vite = await createViteServer({
      root: projectRoot,
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)

    // SPA fallback：非 /api 路由返回 index.html（经 Vite 转换注入 HMR client）
    app.use('*', async (req, res, next) => {
      try {
        const template = fs.readFileSync(
          path.resolve(projectRoot, 'index.html'),
          'utf-8',
        )
        const html = await vite.transformIndexHtml(req.originalUrl, template)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      } catch (e) {
        next(e)
      }
    })
  } else {
    // 生产：托管构建产物
    app.use(express.static(path.resolve(projectRoot, 'dist')))
    app.use('*', (_req, res) => {
      res.sendFile(path.resolve(projectRoot, 'dist/index.html'))
    })
  }

  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`)
    console.log(`  前台: http://localhost:${PORT}/`)
    console.log(`  API : http://localhost:${PORT}/api`)
    console.log(`  ESP32 上报: http://localhost:${PORT}/api/reports`)
  })

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, closing...`)
    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main()

export default app
