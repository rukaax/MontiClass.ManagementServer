<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  Bot,
  Wifi,
  WifiOff,
  Send,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  User,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Thermometer,
  Droplets,
  Wind,
  Radio,
  Trash2,
} from 'lucide-vue-next'
import { api, type AiChatMessage, type AiConfigInfo } from '@/api/client'
import {
  normalizeDeviceBase,
  getDeviceStatus,
  getDeviceActuator,
  executeToolCall,
  type DeviceStatus,
  type DeviceActuator,
} from '@/lib/device'
import { useAuthStore } from '@/stores/auth'
import FluentButton from '@/components/FluentButton.vue'
import FluentBadge from '@/components/FluentBadge.vue'
import { fmtNum } from '@/lib/format'

const auth = useAuthStore()
const isAdmin = computed(() => auth.role === 'admin')

// ===== 设备连接 =====
const IP_STORAGE_KEY = 'esp32_device_ip'
const ipInput = ref(localStorage.getItem(IP_STORAGE_KEY) || '')
const base = computed(() => normalizeDeviceBase(ipInput.value))
const connected = ref(false)
const connecting = ref(false)
const connError = ref('')
const status = ref<DeviceStatus | null>(null)
const actuator = ref<DeviceActuator | null>(null)

// ===== AI 配置 =====
const aiConfig = ref<AiConfigInfo | null>(null)
const configLoading = ref(true)

// ===== 聊天 =====
interface UiMessage {
  id: number
  role: 'user' | 'assistant' | 'action' | 'error'
  text: string
  ok?: boolean
}
const messages = ref<UiMessage[]>([])
const apiMessages = ref<AiChatMessage[]>([])
const input = ref('')
const sending = ref(false)
const chatError = ref('')
const chatEl = ref<HTMLElement | null>(null)
let msgId = 0

const suggestions = computed(() =>
  isAdmin.value
    ? ['现在教室环境怎么样？', '把风扇调到正转 60%', '三路灯亮度调到 60/50/40', '恢复全部自动控制']
    : ['现在教室环境怎么样？', '当前光照和空气质量如何？'],
)

async function refreshState() {
  const [s, a] = await Promise.all([
    getDeviceStatus(base.value),
    getDeviceActuator(base.value),
  ])
  status.value = s
  actuator.value = a
}

async function connect() {
  connError.value = ''
  if (!ipInput.value.trim()) {
    connError.value = '请输入 ESP32 设备 IP'
    return
  }
  if (!base.value) {
    connError.value = 'IP 格式不正确，示例：192.168.1.88'
    return
  }
  connecting.value = true
  try {
    await refreshState()
    connected.value = true
    localStorage.setItem(IP_STORAGE_KEY, ipInput.value.trim())
    scrollToBottom()
  } catch (e: any) {
    connected.value = false
    status.value = null
    actuator.value = null
    connError.value = e?.message || '连接设备失败'
  } finally {
    connecting.value = false
  }
}

function disconnect() {
  connected.value = false
  status.value = null
  actuator.value = null
  connError.value = ''
}

async function refreshConnection() {
  if (!connected.value) return
  try {
    await refreshState()
  } catch (e: any) {
    connected.value = false
    connError.value = e?.message || '设备连接已断开'
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
  })
}

function pushMsg(role: UiMessage['role'], text: string, ok?: boolean) {
  messages.value.push({ id: ++msgId, role, text, ok })
  scrollToBottom()
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value || !connected.value) return

  input.value = ''
  chatError.value = ''
  pushMsg('user', content)
  apiMessages.value.push({ role: 'user', content })
  sending.value = true

  try {
    // 发送前刷新一次设备快照，作为 AI 的上下文
    try {
      await refreshState()
    } catch {
      /* 保留上一次快照，具体工具执行时会返回错误 */
    }

    let gotReply = false
    for (let round = 0; round < 6; round++) {
      const res = await api.aiChat({
        messages: apiMessages.value,
        state: {
          connected: connected.value,
          ip: base.value,
          status: status.value,
          actuator: actuator.value,
        },
      })
      const msg = res.data.message
      apiMessages.value.push({
        role: 'assistant',
        content: msg.content,
        tool_calls: msg.tool_calls,
      })

      if (msg.content) {
        pushMsg('assistant', msg.content)
        gotReply = true
      }

      if (!msg.tool_calls?.length) break

      for (const tc of msg.tool_calls) {
        const exec = await executeToolCall(base.value, tc)
        pushMsg('action', exec.label, exec.ok)
        apiMessages.value.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({
            name: exec.name,
            ok: exec.ok,
            result: exec.result,
          }),
        })
      }
      await refreshState().catch(() => {})
      scrollToBottom()
    }

    if (!gotReply) {
      // 没有最终文本时给一个兜底提示，避免界面空等
      pushMsg('assistant', '操作已提交，但模型没有返回说明。')
    }
  } catch (e: any) {
    chatError.value = e?.message || 'AI 对话失败'
    pushMsg('error', chatError.value)
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function clearChat() {
  messages.value = []
  apiMessages.value = []
  chatError.value = ''
}

async function loadConfig() {
  configLoading.value = true
  try {
    const res = await api.aiConfig()
    aiConfig.value = res.data
  } catch {
    aiConfig.value = null
  } finally {
    configLoading.value = false
  }
}

onMounted(async () => {
  await loadConfig()
  if (ipInput.value.trim()) await connect()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-5">
    <!-- AI 未配置提示 -->
    <div
      v-if="!configLoading && aiConfig && !aiConfig.configured"
      class="fluent-card p-3 flex items-center gap-3"
      style="border-color: var(--warning)"
    >
      <AlertTriangle :size="18" class="shrink-0" style="color: var(--warning)" />
      <span class="text-sm text-ink-1 flex-1">
        AI 模型尚未配置。请先在
        <router-link v-if="isAdmin" to="/settings" class="underline" style="color: var(--info)">
          系统设置
        </router-link>
        <span v-else>系统设置</span>
        中填写 OpenAI 兼容接口的 Base URL、模型与 API Key。
      </span>
    </div>

    <!-- 设备连接 -->
    <div class="fluent-card p-4 sm:p-5 fade-up">
      <div class="flex items-center gap-3 mb-4">
        <span
          class="w-10 h-10 rounded-lg grid place-items-center shrink-0"
          style="background: var(--info-bg); color: var(--info)"
        >
          <Wifi :size="20" />
        </span>
        <div class="flex-1 min-w-0">
          <h2 class="text-[15px] font-semibold text-ink-1">连接教室设备</h2>
          <p class="text-[12px] text-ink-4 mt-0.5">
            填写 ESP32 的内网 IP，浏览器将直接访问设备接口
          </p>
        </div>
        <FluentBadge :status="connected ? 'success' : 'neutral'" dot>
          {{ connected ? '已连接' : '未连接' }}
        </FluentBadge>
      </div>

      <div class="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label class="block flex-1">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">设备 IP</span>
          <input
            v-model="ipInput"
            :disabled="connecting"
            placeholder="192.168.1.88"
            class="w-full h-9 px-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30"
            @keydown.enter="connect"
          />
        </label>
        <div class="flex gap-2">
          <FluentButton variant="primary" :loading="connecting" @click="connect">
            <RefreshCw :size="15" />
            {{ connected ? '重新连接' : '连接设备' }}
          </FluentButton>
          <FluentButton v-if="connected" variant="standard" @click="refreshConnection">
            刷新
          </FluentButton>
          <FluentButton v-if="connected" variant="subtle" @click="disconnect">
            <WifiOff :size="15" />
          </FluentButton>
        </div>
      </div>

      <p v-if="connError" class="mt-3 text-[12px]" style="color: var(--danger)">
        {{ connError }}
      </p>

      <!-- 当前状态 -->
      <div
        v-if="connected && status"
        class="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2"
      >
        <div class="p-2.5 rounded-fluent" style="background: var(--bg-card-2)">
          <div class="flex items-center gap-1 text-[11px] text-ink-4"><Lightbulb :size="12" />光照 1</div>
          <div class="text-[14px] text-ink-1 tabular-nums">{{ fmtNum(status.light) }}%</div>
        </div>
        <div class="p-2.5 rounded-fluent" style="background: var(--bg-card-2)">
          <div class="flex items-center gap-1 text-[11px] text-ink-4"><Lightbulb :size="12" />光照 2</div>
          <div class="text-[14px] text-ink-1 tabular-nums">{{ fmtNum(status.light2) }}%</div>
        </div>
        <div class="p-2.5 rounded-fluent" style="background: var(--bg-card-2)">
          <div class="flex items-center gap-1 text-[11px] text-ink-4"><Wind :size="12" />AQI</div>
          <div class="text-[14px] text-ink-1 tabular-nums">{{ status.air ?? '—' }}</div>
        </div>
        <div class="p-2.5 rounded-fluent" style="background: var(--bg-card-2)">
          <div class="flex items-center gap-1 text-[11px] text-ink-4"><Thermometer :size="12" />温度</div>
          <div class="text-[14px] text-ink-1 tabular-nums">{{ fmtNum(status.temperature) }}°C</div>
        </div>
        <div class="p-2.5 rounded-fluent" style="background: var(--bg-card-2)">
          <div class="flex items-center gap-1 text-[11px] text-ink-4"><Droplets :size="12" />湿度</div>
          <div class="text-[14px] text-ink-1 tabular-nums">{{ fmtNum(status.humidity) }}%</div>
        </div>
      </div>

      <div
        v-if="connected && actuator"
        class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3"
      >
        <span>舵机 {{ actuator.angle }}°</span>
        <span>风扇 {{ actuator.fanDirection === 0 ? '停止' : actuator.fanDirection === 1 ? '正转' : '反转' }} {{ actuator.fanSpeed }}%</span>
        <span>LED {{ actuator.led1Brightness }}/{{ actuator.led2Brightness }}/{{ actuator.led3Brightness }}%</span>
        <span>蜂鸣器 {{ actuator.buzzerEnabled ? '开' : '关' }}</span>
        <span>人体 {{ status?.presence ? '有人' : '无人' }}</span>
      </div>
    </div>

    <!-- 只读用户提示 -->
    <div
      v-if="!isAdmin"
      class="fluent-card p-3 flex items-center gap-3"
      style="border-color: var(--info)"
    >
      <User :size="18" class="shrink-0" style="color: var(--info)" />
      <span class="text-[13px] text-ink-2">
        只读用户：可以查询环境数据并咨询 AI，但不能通过 AI 控制设备。
      </span>
    </div>

    <!-- 聊天区 -->
    <div class="fluent-card overflow-hidden fade-up">
      <div
        class="flex items-center gap-2 px-4 h-12 border-b"
        style="border-color: var(--stroke)"
      >
        <Bot :size="18" style="color: var(--fluent-primary)" />
        <span class="text-[14px] font-semibold text-ink-1">AI 环境助手</span>
        <div class="flex-1" />
        <button
          v-if="messages.length"
          class="flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink-1 transition-colors"
          @click="clearChat"
        >
          <Trash2 :size="14" />
          清空
        </button>
      </div>

      <div
        ref="chatEl"
        class="px-4 py-4 space-y-3 overflow-y-auto"
        style="min-height: 320px; max-height: 52vh"
      >
        <!-- 空状态 -->
        <div v-if="!messages.length" class="h-full flex flex-col items-center justify-center py-10 text-center">
          <div
            class="w-12 h-12 rounded-full grid place-items-center mb-3"
            style="background: var(--fluent-primary-tint); color: var(--fluent-primary)"
          >
            <Sparkles :size="22" />
          </div>
          <p class="text-[14px] font-medium text-ink-1">
            {{ connected ? '告诉我你想怎么调节教室环境' : '请先连接教室设备' }}
          </p>
          <p class="text-[12px] text-ink-4 mt-1">
            {{ connected ? '例如：把风扇调到 60%，或者问“现在环境怎么样？”' : '连接成功后即可开始对话' }}
          </p>
          <div v-if="connected" class="mt-4 flex flex-wrap justify-center gap-2">
            <button
              v-for="s in suggestions"
              :key="s"
              class="px-3 py-1.5 rounded-fluent text-[12px] border transition-colors hover:bg-surface-hover"
              style="border-color: var(--stroke-strong); color: var(--text-2)"
              @click="send(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <template v-for="m in messages" :key="m.id">
          <!-- 用户 -->
          <div v-if="m.role === 'user'" class="flex justify-end">
            <div
              class="max-w-[85%] px-3.5 py-2 rounded-fluent text-[13px] text-white whitespace-pre-wrap break-words"
              style="background: var(--fluent-primary)"
            >
              {{ m.text }}
            </div>
          </div>

          <!-- AI -->
          <div v-else-if="m.role === 'assistant'" class="flex gap-2">
            <div
              class="w-7 h-7 rounded-full grid place-items-center shrink-0"
              style="background: var(--fluent-primary-tint); color: var(--fluent-primary)"
            >
              <Bot :size="15" />
            </div>
            <div
              class="max-w-[85%] px-3.5 py-2 rounded-fluent text-[13px] text-ink-1 whitespace-pre-wrap break-words"
              style="background: var(--bg-card-2)"
            >
              {{ m.text }}
            </div>
          </div>

          <!-- 工具执行结果 -->
          <div v-else-if="m.role === 'action'" class="flex justify-center">
            <div
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border"
              :style="{
                borderColor: m.ok ? 'var(--success)' : 'var(--danger)',
                background: m.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: m.ok ? 'var(--success)' : 'var(--danger)',
              }"
            >
              <CheckCircle2 v-if="m.ok" :size="12" />
              <XCircle v-else :size="12" />
              {{ m.text }}<span class="opacity-70">{{ m.ok ? ' · 已执行' : ' · 失败' }}</span>
            </div>
          </div>

          <!-- 错误 -->
          <div v-else class="flex justify-center">
            <div
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
              style="background: var(--danger-bg); color: var(--danger)"
            >
              <AlertTriangle :size="12" />
              {{ m.text }}
            </div>
          </div>
        </template>

        <div v-if="sending" class="flex gap-2">
          <div
            class="w-7 h-7 rounded-full grid place-items-center shrink-0"
            style="background: var(--fluent-primary-tint); color: var(--fluent-primary)"
          >
            <Bot :size="15" />
          </div>
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-fluent" style="background: var(--bg-card-2)">
            <div class="spinner" />
            <span class="text-[12px] text-ink-3">AI 正在思考并操作设备…</span>
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="p-3 border-t" style="border-color: var(--stroke)">
        <div
          v-if="!connected"
          class="mb-2 flex items-center gap-1.5 text-[12px] text-ink-4"
        >
          <Radio :size="12" />
          请先在上方填写设备 IP 并连接
        </div>
        <div class="flex items-end gap-2">
          <textarea
            v-model="input"
            :disabled="!connected || sending"
            rows="2"
            placeholder="描述你想调节的环境，例如：有人时把灯调到 70%，风太大就调小一点"
            class="flex-1 resize-none px-3 py-2 rounded-fluent bg-surface-card text-ink-1 text-[13px] border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30 disabled:opacity-60"
            @keydown="onKeydown"
          />
          <FluentButton
            variant="primary"
            :loading="sending"
            :disabled="!connected || !input.trim()"
            @click="send()"
          >
            <Send :size="15" />
            发送
          </FluentButton>
        </div>
        <p class="mt-2 text-[11px] text-ink-4">
          AI 会根据你的描述调用设备接口。控制结果以设备实际返回为准，请谨慎操作。
        </p>
      </div>
    </div>
  </div>
</template>
