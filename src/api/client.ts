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

export interface HistoryData {
  total: number
  page: number
  size: number
  items: ReportRow[]
}

export interface StatsPoint {
  t: string
  avg: number | null
  min: number | null
  max: number | null
  count: number
}

export interface StatsData {
  metric: string
  points: StatsPoint[]
}

export interface DeviceInfo {
  device_id: string
  last_seen: string
  count: number
}

const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('admin_token')
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error('网络请求失败，请检查后端服务是否已启动')
  }
  let data: any = null
  try {
    data = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok) {
    const msg = data?.error || `请求失败 (HTTP ${res.status})`
    if (res.status === 401) {
      // token 失效：清除并跳登录页（整页刷新，保证状态干净）
      localStorage.removeItem('admin_token')
      if (location.pathname !== '/login') {
        location.replace(
          `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`,
        )
      }
    }
    throw new Error(msg)
  }
  return data as T
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const api = {
  login(username: string, password: string) {
    return request<{ ok: true; token: string; username: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
    )
  },
  latest(deviceId?: string) {
    return request<{ ok: true; data: ReportRow | null }>(
      `/reports/latest${qs({ device_id: deviceId })}`,
    )
  },
  history(p: {
    deviceId?: string
    start?: string
    end?: string
    page?: number
    size?: number
  }) {
    return request<{ ok: true; data: HistoryData }>(
      `/reports/history${qs({
        device_id: p.deviceId,
        start: p.start,
        end: p.end,
        page: p.page,
        size: p.size,
      })}`,
    )
  },
  stats(p: {
    metric: string
    granularity?: 'hour' | 'day'
    deviceId?: string
    start?: string
    end?: string
  }) {
    return request<{ ok: true; data: StatsData }>(
      `/reports/stats${qs({
        metric: p.metric,
        granularity: p.granularity,
        device_id: p.deviceId,
        start: p.start,
        end: p.end,
      })}`,
    )
  },
  tokenInfo() {
    return request<{
      ok: true
      data: { token_masked: string; updated_at: string | null }
    }>('/settings/token')
  },
  updateToken(new_token: string) {
    return request<{ ok: true }>('/settings/token', {
      method: 'PUT',
      body: JSON.stringify({ new_token }),
    })
  },
  rotateToken() {
    return request<{ ok: true; data: { token: string } }>(
      '/settings/token/rotate',
      { method: 'POST' },
    )
  },
  changePassword(current_password: string, new_password: string) {
    return request<{ ok: true }>('/settings/password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    })
  },
  devices() {
    return request<{ ok: true; data: DeviceInfo[] }>('/settings/devices')
  },
}
