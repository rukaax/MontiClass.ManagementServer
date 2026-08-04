export interface ReportPayload {
  device_id: string
  light1?: number | null
  light2?: number | null
  aqi?: number | null
  temperature?: number | null
  speed?: number | null
  presence?: boolean | null
  reported_at?: string | null
}

export interface ReportRow {
  id?: number
  device_id: string
  light1: number | null
  light2: number | null
  aqi: number | null
  temperature: number | null
  speed: number | null
  presence: boolean | null
  reported_at: string
  received_at: string
}

export interface StatsPoint {
  t: string
  avg: number | null
  min: number | null
  max: number | null
  count: number
}
