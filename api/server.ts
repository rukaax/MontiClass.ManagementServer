/**
 * 本地开发服务入口
 */
import app from './app.js'
import { migrate } from './db/migrate.js'
import { pool } from './db/pool.js'

const PORT = process.env.PORT || 3001

async function main(): Promise<void> {
  try {
    await migrate()
  } catch (e) {
    console.error('[db] 启动迁移失败，请检查 PostgreSQL 配置（.env）:', e)
    console.error('    服务仍将启动，但数据库相关接口会报错。')
  }

  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`)
    console.log(`  ESP32 上报地址: http://localhost:${PORT}/api/reports`)
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
