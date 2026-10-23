/**
 * ESP32 设备直连客户端（浏览器直接访问设备内网 IP）
 * 接口说明见 API-MontiClass.md
 */

export interface DeviceStatus {
  light: number | null
  light2: number | null
  air: number | null
  airRaw: number | null
  airMv: number | null
  airBaseline: number | null
  airReady: boolean
  temperature: number | null
  humidity: number | null
  presence: boolean
  provisioning: boolean
  connected: boolean
  rtcNow: string | null
  rtcValid: boolean
  ntpServer: string
  apSsid: string
  ip: string
}

export interface DeviceActuator {
  ready: boolean
  angle: number
  manual: boolean
  fanReady: boolean
  fanRunning: boolean
  fanManual: boolean
  fanDirection: number
  fanSpeed: number
  lightingReady: boolean
  lightingManual: boolean
  led1Brightness: number
  led2Brightness: number
  led3Brightness: number
  buzzerEnabled: boolean
}

export interface AiToolCallInput {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolExecution {
  name: string
  label: string
  ok: boolean
  result: unknown
}

/** 规范化用户输入的设备地址：允许只填 IP */
export function normalizeDeviceBase(input: string): string {
  let s = input.trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  try {
    const u = new URL(s)
    if (!u.hostname) return ''
    return `${u.protocol}//${u.host}`
  } catch {
    return ''
  }
}

function deviceFetchError(base: string, e: unknown): Error {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return new Error(`设备 ${base} 请求超时，请检查 IP 与网络`)
  }
  return new Error(
    `无法连接设备 ${base}。请确认 IP 正确、浏览器与 ESP32 在同一局域网，并让 ESP32 固件允许跨域（CORS）。` +
      ` 若本页面通过 HTTPS 打开，浏览器会拦截 http:// 设备请求（混合内容）。`,
  )
}

async function deviceFetch<T>(
  base: string,
  path: string,
  init?: RequestInit,
  timeoutMs = 6000,
): Promise<T> {
  const url = `${normalizeDeviceBase(base)}${path}`
  if (!normalizeDeviceBase(base)) throw new Error('设备 IP 未配置或格式不正确')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
  } catch (e) {
    throw deviceFetchError(base, e)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new Error(`设备返回错误（HTTP ${res.status}）`)
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new Error('设备返回内容不是有效的 JSON')
  }
}

export function getDeviceStatus(base: string): Promise<DeviceStatus> {
  return deviceFetch<DeviceStatus>(base, '/api/status')
}

export function getDeviceActuator(base: string): Promise<DeviceActuator> {
  return deviceFetch<DeviceActuator>(base, '/api/actuator')
}

export interface ActuatorResponse {
  ok?: boolean
  message?: string
}

export function postDeviceActuator(
  base: string,
  params: Record<string, string | number>,
): Promise<ActuatorResponse> {
  const body = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => body.set(k, String(v)))
  return deviceFetch<ActuatorResponse>(base, '/api/actuator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseArgs(raw: string): Record<string, any> {
  try {
    const v = JSON.parse(raw || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function describeToolCall(name: string, args: Record<string, any>): string {
  switch (name) {
    case 'get_device_status':
      return '读取传感器数据'
    case 'get_actuator_state':
      return '读取执行器状态'
    case 'set_servo':
      return `舵机转到 ${args.angle}°`
    case 'set_fan': {
      const d = Number(args.direction)
      if (d === 0) return '停止风扇'
      return `风扇${d === -1 ? '反转' : '正转'} ${args.speed}%`
    }
    case 'set_leds':
      return `LED 亮度 ${args.led1}/${args.led2}/${args.led3}%`
    case 'set_buzzer':
      return args.enabled ? '开启蜂鸣器' : '关闭蜂鸣器'
    case 'set_auto_mode': {
      const modes: Record<string, string> = {
        auto: '全部自动',
        servo_auto: '仅舵机自动',
        fan_auto: '仅风扇自动',
        lighting_auto: '仅照明自动',
      }
      return `恢复${modes[String(args.mode)] || String(args.mode)}`
    }
    default:
      return name
  }
}

/** 执行 AI 返回的工具调用（直接请求 ESP32） */
export async function executeToolCall(
  base: string,
  call: AiToolCallInput,
): Promise<ToolExecution> {
  const name = call.function.name
  const args = parseArgs(call.function.arguments)
  const label = describeToolCall(name, args)

  try {
    switch (name) {
      case 'get_device_status': {
        const result = await getDeviceStatus(base)
        return { name, label, ok: true, result }
      }
      case 'get_actuator_state': {
        const result = await getDeviceActuator(base)
        return { name, label, ok: true, result }
      }
      case 'set_servo': {
        const angle = clamp(Math.round(Number(args.angle) || 0), 0, 180)
        const result = await postDeviceActuator(base, { servo_angle: angle })
        return { name, label, ok: true, result }
      }
      case 'set_fan': {
        let direction = Number(args.direction)
        if (![-1, 0, 1].includes(direction)) direction = 0
        const speed =
          direction === 0 ? 0 : clamp(Math.round(Number(args.speed) || 0), 0, 100)
        const result = await postDeviceActuator(base, {
          fan_direction: direction,
          fan_speed: speed,
        })
        return { name, label, ok: true, result }
      }
      case 'set_leds': {
        const result = await postDeviceActuator(base, {
          led1_brightness: clamp(Math.round(Number(args.led1) || 0), 0, 100),
          led2_brightness: clamp(Math.round(Number(args.led2) || 0), 0, 100),
          led3_brightness: clamp(Math.round(Number(args.led3) || 0), 0, 100),
        })
        return { name, label, ok: true, result }
      }
      case 'set_buzzer': {
        const result = await postDeviceActuator(base, {
          buzzer_enabled: args.enabled ? 1 : 0,
        })
        return { name, label, ok: true, result }
      }
      case 'set_auto_mode': {
        const allowed = ['auto', 'servo_auto', 'fan_auto', 'lighting_auto']
        const mode = allowed.includes(String(args.mode)) ? String(args.mode) : 'auto'
        const result = await postDeviceActuator(base, { mode })
        return { name, label, ok: true, result }
      }
      default:
        return {
          name,
          label,
          ok: false,
          result: { error: `不支持的操作：${name}` },
        }
    }
  } catch (e: any) {
    return {
      name,
      label,
      ok: false,
      result: { error: e?.message || '执行失败' },
    }
  }
}
