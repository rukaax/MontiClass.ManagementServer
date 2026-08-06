export interface ReportPayload {
  device_id: string
  light1?: number | null          // 光敏1 亮度百分比 0-100
  light2?: number | null          // 光敏2 亮度百分比 0-100
  light1_adc?: number | null      // 光敏1 ADC 原始值 0-4095
  light2_adc?: number | null      // 光敏2 ADC 原始值 0-4095
  aqi?: number | null
  temperature?: number | null
  humidity?: number | null           // 相对湿度 % 0-100
  presence?: boolean | null
  reported_at?: string | null
}

export interface ReportRow {
  id?: number
  device_id: string
  light1: number | null
  light2: number | null
  light1_adc: number | null
  light2_adc: number | null
  aqi: number | null
  temperature: number | null
  humidity: number | null
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
