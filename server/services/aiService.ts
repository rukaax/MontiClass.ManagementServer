/**
 * AI 助手服务：配置读写 + OpenAI 兼容 Chat Completions（工具调用）
 */
import { pool } from '../db/pool.js'
import { decryptSecret, encryptSecret } from '../lib/crypto.js'

export interface AiConfigRow {
  base_url: string
  api_key_enc: string
  model: string
  updated_at: string | null
}

export interface AiConfigPublic {
  base_url: string
  model: string
  api_key_masked: string
  has_key: boolean
  configured: boolean
  updated_at: string | null
}

export interface AiConfigForUse {
  base_url: string
  api_key: string
  model: string
}

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
}

export async function getAiConfigRow(): Promise<AiConfigRow> {
  const { rows } = await pool.query<AiConfigRow>(
    `SELECT base_url, api_key_enc, model, updated_at FROM ai_config WHERE id = 1`,
  )
  return (
    rows[0] ?? { base_url: '', api_key_enc: '', model: '', updated_at: null }
  )
}

export async function getAiConfigPublic(): Promise<AiConfigPublic> {
  const row = await getAiConfigRow()
  const apiKey = decryptSecret(row.api_key_enc)
  return {
    base_url: row.base_url,
    model: row.model,
    api_key_masked: maskKey(apiKey),
    has_key: !!apiKey,
    configured: !!(row.base_url && row.model && apiKey),
    updated_at: row.updated_at,
  }
}

export async function getAiConfigForUse(): Promise<AiConfigForUse> {
  const row = await getAiConfigRow()
  return {
    base_url: row.base_url.trim(),
    api_key: decryptSecret(row.api_key_enc),
    model: row.model.trim(),
  }
}

/** 保存配置；apiKey 为空时保留原 Key */
export async function saveAiConfig(input: {
  base_url: string
  model: string
  api_key?: string
}): Promise<void> {
  const current = await getAiConfigRow()
  const keyEnc =
    input.api_key && input.api_key.trim()
      ? encryptSecret(input.api_key.trim())
      : current.api_key_enc

  await pool.query(
    `INSERT INTO ai_config (id, base_url, api_key_enc, model, updated_at)
     VALUES (1, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE
       SET base_url = EXCLUDED.base_url,
           api_key_enc = EXCLUDED.api_key_enc,
           model = EXCLUDED.model,
           updated_at = NOW()`,
    [input.base_url.trim(), keyEnc, input.model.trim()],
  )
}

// ===================== Chat Completions =====================

export interface AiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AiMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AiToolCall[]
  tool_call_id?: string
}

interface DeviceState {
  connected?: boolean
  ip?: string
  status?: unknown
  actuator?: unknown
}

/** 设备控制工具（由前端浏览器直连 ESP32 执行） */
const DEVICE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_device_status',
      description:
        '读取教室当前传感器数据：两路光照百分比、AQI、温度、湿度、是否有人、空气质量是否就绪等',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_actuator_state',
      description:
        '读取执行器当前状态：舵机角度、风扇方向/转速、三路 LED 亮度、蜂鸣器开关',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_servo',
      description: '设置舵机角度（0-180 度）',
      parameters: {
        type: 'object',
        properties: {
          angle: { type: 'number', description: '目标角度，0-180' },
        },
        required: ['angle'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_fan',
      description: '设置风扇方向与转速；direction=1 正转，-1 反转，0 停止',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'number', enum: [-1, 0, 1], description: '方向' },
          speed: { type: 'number', description: '转速百分比 0-100' },
        },
        required: ['direction', 'speed'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_leds',
      description: '设置三路 LED 照明亮度（0-100）',
      parameters: {
        type: 'object',
        properties: {
          led1: { type: 'number', description: 'LED1 亮度 0-100' },
          led2: { type: 'number', description: 'LED2 亮度 0-100' },
          led3: { type: 'number', description: 'LED3 亮度 0-100' },
        },
        required: ['led1', 'led2', 'led3'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_buzzer',
      description: '开启或关闭蜂鸣器',
      parameters: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'true 开启，false 关闭' },
        },
        required: ['enabled'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_auto_mode',
      description: '恢复设备自动控制模式',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['auto', 'servo_auto', 'fan_auto', 'lighting_auto'],
            description:
              'auto=全部自动，servo_auto=仅舵机，fan_auto=仅风扇，lighting_auto=仅照明',
          },
        },
        required: ['mode'],
      },
    },
  },
] as const

function buildSystemPrompt(canControl: boolean, state?: DeviceState): string {
  const stateText = state
    ? JSON.stringify(state).slice(0, 4000)
    : 'null（尚未连接设备）'

  const base = `你是「智能教室环境助手」，帮助用户查看并调节教室环境。设备是同一局域网内的 ESP32，通过浏览器直连。
当前设备状态快照（前端采集，可能为 null）：
${stateText}

可用工具：查询传感器、查询执行器、设置舵机角度、设置风扇方向与转速、设置三路 LED 亮度、开关蜂鸣器、恢复自动模式。

规则：
1. 用户要求调节时，必须调用对应工具，不要只给文字建议。
2. 调节前若对当前状态没有把握，先调用查询工具确认。
3. 参数范围：舵机 0-180 度；风扇 direction 为 -1 反转 / 0 停止 / 1 正转，speed 0-100；LED 亮度 0-100。
4. 一次可以调用多个工具，控制完成后用中文简要汇报结果。
5. 如果用户只是咨询环境情况，直接根据状态快照回答，不要随意改动设备。
6. 不要编造设备读数；工具执行失败时如实说明原因。`

  return canControl
    ? base
    : `${base}

注意：当前用户是只读用户，没有设备控制权限。你只能查询和给出建议，绝对不要调用任何控制类工具。`
}

/** 清洗前端传来的消息，防止注入异常结构 */
function sanitizeMessages(raw: unknown): AiMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(-40)
    .map((m: any): AiMessage | null => {
      const role = m?.role
      if (role !== 'user' && role !== 'assistant' && role !== 'tool') return null
      const msg: AiMessage = {
        role,
        content: typeof m?.content === 'string' ? m.content.slice(0, 4000) : null,
      }
      if (role === 'assistant' && Array.isArray(m?.tool_calls)) {
        msg.tool_calls = m.tool_calls.slice(0, 10).map((tc: any) => ({
          id: String(tc?.id || ''),
          type: 'function',
          function: {
            name: String(tc?.function?.name || ''),
            arguments:
              typeof tc?.function?.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc?.function?.arguments ?? {}),
          },
        }))
      }
      if (role === 'tool') msg.tool_call_id = String(m?.tool_call_id || '')
      // 跳过既无文本也无工具调用的空 assistant 消息，避免模型接口报错
      if (role === 'assistant' && !msg.content && !msg.tool_calls?.length) return null
      return msg
    })
    .filter((m): m is AiMessage => !!m)
}

export async function chatWithAi(
  cfg: AiConfigForUse,
  rawMessages: unknown,
  state: DeviceState | undefined,
  canControl: boolean,
): Promise<AiMessage> {
  if (!cfg.base_url || !cfg.model || !cfg.api_key) {
    throw new Error('AI 模型尚未配置，请先在「系统设置」中填写 Base URL、模型与 API Key')
  }

  const history = sanitizeMessages(rawMessages)
  if (!history.length) throw new Error('消息不能为空')

  const url = /\/chat\/completions$/.test(cfg.base_url)
    ? cfg.base_url
    : `${cfg.base_url.replace(/\/+$/, '')}/chat/completions`

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: 'system', content: buildSystemPrompt(canControl, state) },
      ...history,
    ],
    temperature: 0.3,
    max_tokens: 800,
  }
  if (canControl) {
    body.tools = DEVICE_TOOLS
    body.tool_choice = 'auto'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (e: any) {
    throw new Error(
      e?.name === 'AbortError' ? 'AI 模型请求超时' : `无法连接 AI 模型：${e?.message || '网络错误'}`,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AI 模型调用失败（HTTP ${res.status}）：${text.slice(0, 300)}`)
  }

  const data: any = await res.json().catch(() => null)
  const message = data?.choices?.[0]?.message
  if (!message) throw new Error('AI 模型返回内容为空')

  const result: AiMessage = {
    role: 'assistant',
    content: typeof message.content === 'string' ? message.content : null,
  }
  if (Array.isArray(message.tool_calls)) {
    result.tool_calls = message.tool_calls.slice(0, 10).map((tc: any) => ({
      id: String(tc?.id || ''),
      type: 'function',
      function: {
        name: String(tc?.function?.name || ''),
        arguments:
          typeof tc?.function?.arguments === 'string'
            ? tc.function.arguments
            : JSON.stringify(tc?.function?.arguments ?? {}),
      },
    }))
  }
  return result
}
