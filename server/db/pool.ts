import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

// 优先使用 DATABASE_URL 连接串；未配置时回退到独立 PG_* 变量
export const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
      }
    : {
        host: process.env.PG_HOST || '127.0.0.1',
        port: Number(process.env.PG_PORT || 5432),
        database: process.env.PG_DATABASE || 'esp32_classroom',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        max: 10,
        idleTimeoutMillis: 30000,
      },
)

pool.on('error', (err) => {
  console.error('[pg] idle client error', err.message)
})
