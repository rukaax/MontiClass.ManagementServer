import { pool } from '../db/pool.js'
import type { ReportPayload, ReportRow, StatsPoint } from '../types.js'

const NUMERIC_METRICS = [
  'light1',
  'light2',
  'light1_adc',
  'light2_adc',
  'aqi',
  'temperature',
  'humidity',
] as const
type NumericMetric = (typeof NUMERIC_METRICS)[number]

export async function insertReport(
  p: ReportPayload,
): Promise<{ id: number; reported_at: string; received_at: string }> {
  const reportedAt = p.reported_at ? new Date(p.reported_at) : new Date()
  const { rows } = await pool.query(
    `INSERT INTO device_reports
       (device_id, light1, light2, light1_adc, light2_adc, aqi, temperature, humidity, presence, reported_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, reported_at, received_at`,
    [
      p.device_id,
      p.light1 ?? null,
      p.light2 ?? null,
      p.light1_adc ?? null,
      p.light2_adc ?? null,
      p.aqi ?? null,
      p.temperature ?? null,
      p.humidity ?? null,
      p.presence ?? null,
      reportedAt,
    ],
  )
  return rows[0]
}

export async function getLatest(deviceId?: string): Promise<ReportRow | null> {
  const params: string[] = []
  let where = ''
  if (deviceId) {
    params.push(deviceId)
    where = 'WHERE device_id = $1'
  }
  const { rows } = await pool.query(
    `SELECT device_id, light1, light2, light1_adc, light2_adc, aqi, temperature, humidity, presence,
            reported_at, received_at
     FROM device_reports ${where}
     ORDER BY reported_at DESC LIMIT 1`,
    params,
  )
  return rows[0] ?? null
}

export interface HistoryOptions {
  deviceId?: string
  start?: string
  end?: string
  page: number
  size: number
}

export async function getHistory(opts: HistoryOptions) {
  const conditions: string[] = []
  const params: (string | number)[] = []
  if (opts.deviceId) {
    params.push(opts.deviceId)
    conditions.push(`device_id = $${params.length}`)
  }
  if (opts.start) {
    params.push(opts.start)
    conditions.push(`reported_at >= $${params.length}`)
  }
  if (opts.end) {
    params.push(opts.end)
    conditions.push(`reported_at <= $${params.length}`)
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const page = Math.max(1, opts.page)
  const size = Math.min(200, Math.max(1, opts.size))
  const offset = (page - 1) * size

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM device_reports ${where}`,
    params,
  )
  const total = countRes.rows[0].total

  const listParams = [...params, size, offset]
  const { rows } = await pool.query<ReportRow>(
    `SELECT id, device_id, light1, light2, light1_adc, light2_adc, aqi, temperature, humidity, presence,
            reported_at, received_at
     FROM device_reports ${where}
     ORDER BY reported_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    listParams,
  )
  return { total, page, size, items: rows }
}

export interface TimelinePoint {
  t: string
  v: number | null
}

export interface TimelineOptions {
  deviceId?: string
  start?: string
  end?: string
  metric: string
}

const METRIC_COLUMNS: Record<string, string> = {
  light1: 'light1',
  light2: 'light2',
  light1_adc: 'light1_adc',
  light2_adc: 'light2_adc',
  aqi: 'aqi',
  temperature: 'temperature',
  humidity: 'humidity',
  presence: '(presence::int)',
}

/** 获取指定指标的数据点（按时间升序），用于图表全量绘制
 *  自动分桶：当范围内点数过多时按时间桶聚合，控制返回点数在 ~1000 以内 */
export async function getTimeline(
  opts: TimelineOptions,
): Promise<{ metric: string; points: TimelinePoint[] }> {
  const col = METRIC_COLUMNS[opts.metric]
  if (!col) throw new Error(`unsupported metric: ${opts.metric}`)

  const conditions: string[] = []
  const params: (string | number)[] = []
  if (opts.deviceId) {
    params.push(opts.deviceId)
    conditions.push(`device_id = $${params.length}`)
  }
  if (opts.start) {
    params.push(opts.start)
    conditions.push(`reported_at >= $${params.length}`)
  }
  if (opts.end) {
    params.push(opts.end)
    conditions.push(`reported_at <= $${params.length}`)
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  // 计算时间跨度，决定分桶秒数（目标 ~1000 桶）
  const startTs = opts.start ? new Date(opts.start).getTime() : Date.now() - 30 * 86400_000
  const endTs = opts.end ? new Date(opts.end).getTime() : Date.now()
  const totalSec = Math.max(60, (endTs - startTs) / 1000)
  const bucketSec = Math.max(1, Math.round(totalSec / 1000))

  // 动态分桶：FLOOR(epoch / bucket) * bucket 作为桶边界
  const bucketParamIdx = params.length + 1
  const { rows } = await pool.query<{ t: string; v: number | null }>(
    `SELECT to_timestamp(FLOOR(EXTRACT(epoch FROM reported_at) / $${bucketParamIdx}) * $${bucketParamIdx}) AS t,
            AVG(${col})::float8 AS v
     FROM device_reports ${where ? where + ` AND ${col} IS NOT NULL` : `WHERE ${col} IS NOT NULL`}
     GROUP BY t
     ORDER BY t ASC`,
    [...params, bucketSec],
  )
  return { metric: opts.metric, points: rows as TimelinePoint[] }
}

export interface StatsOptions {
  deviceId?: string
  start?: string
  end?: string
  metric: string
  granularity: 'hour' | 'day'
}

export async function getStats(
  opts: StatsOptions,
): Promise<{ metric: string; points: StatsPoint[] }> {
  const trunc = opts.granularity === 'day' ? 'day' : 'hour'

  const conditions: string[] = []
  const params: (string | number)[] = [trunc]
  if (opts.deviceId) {
    params.push(opts.deviceId)
    conditions.push(`device_id = $${params.length}`)
  }
  if (opts.start) {
    params.push(opts.start)
    conditions.push(`reported_at >= $${params.length}`)
  }
  if (opts.end) {
    params.push(opts.end)
    conditions.push(`reported_at <= $${params.length}`)
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  if (opts.metric === 'presence') {
    const { rows } = await pool.query<StatsPoint>(
      `SELECT date_trunc($1, reported_at) AS t,
              AVG((presence::int))::float8 AS avg,
              MIN((presence::int))::int AS min,
              MAX((presence::int))::int AS max,
              COUNT(*)::int AS count
       FROM device_reports ${where ? where + ' AND ' : 'WHERE '} presence IS NOT NULL
       GROUP BY t ORDER BY t`,
      params,
    )
    return { metric: opts.metric, points: rows }
  }

  if (!NUMERIC_METRICS.includes(opts.metric as NumericMetric)) {
    throw new Error(`unsupported metric: ${opts.metric}`)
  }

  const metric = opts.metric as NumericMetric
  const { rows } = await pool.query<StatsPoint>(
    `SELECT date_trunc($1, reported_at) AS t,
            AVG(${metric})::float8 AS avg,
            MIN(${metric})::float8 AS min,
            MAX(${metric})::float8 AS max,
            COUNT(*)::int AS count
     FROM device_reports ${where ? where + ' AND ' : 'WHERE '} ${metric} IS NOT NULL
     GROUP BY t ORDER BY t`,
    params,
  )
  return { metric: opts.metric, points: rows }
}
