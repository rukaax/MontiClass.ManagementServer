<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  KeyRound,
  Cpu,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-vue-next'
import { api, type DeviceInfo } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import FluentButton from '@/components/FluentButton.vue'
import FluentInput from '@/components/FluentInput.vue'
import FluentBadge from '@/components/FluentBadge.vue'
import { fmtDateTime, timeAgo } from '@/lib/format'

const auth = useAuthStore()

const tokenMasked = ref('')
const tokenUpdatedAt = ref<string | null>(null)
const tokenLoading = ref(true)

const showReset = ref(false)
const newToken = ref('')
const resetting = ref(false)
const resetMsg = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const copied = ref(false)

const devices = ref<DeviceInfo[]>([])
const devicesLoading = ref(true)

async function fetchToken() {
  tokenLoading.value = true
  try {
    const res = await api.tokenInfo()
    tokenMasked.value = res.data.token_masked
    tokenUpdatedAt.value = res.data.updated_at
  } catch {
    /* ignore */
  } finally {
    tokenLoading.value = false
  }
}

async function fetchDevices() {
  devicesLoading.value = true
  try {
    const res = await api.devices()
    devices.value = res.data
  } catch {
    /* ignore */
  } finally {
    devicesLoading.value = false
  }
}

function copyMasked() {
  navigator.clipboard?.writeText(tokenMasked.value).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  })
}

function openReset() {
  newToken.value = ''
  resetMsg.value = null
  showReset.value = true
}

async function submitReset() {
  resetMsg.value = null
  if (newToken.value.trim().length < 6) {
    resetMsg.value = { type: 'error', text: 'Token 至少需要 6 个字符' }
    return
  }
  resetting.value = true
  try {
    await api.updateToken(newToken.value.trim())
    resetMsg.value = { type: 'success', text: 'Token 已更新，请同步到 ESP32 设备' }
    showReset.value = false
    await fetchToken()
  } catch (e: any) {
    resetMsg.value = { type: 'error', text: e?.message || '更新失败' }
  } finally {
    resetting.value = false
  }
}

onMounted(() => {
  fetchToken()
  fetchDevices()
})
</script>

<template>
  <div class="space-y-5 max-w-4xl">
    <!-- Token 配置 -->
    <div class="fluent-card p-6 fade-up">
      <div class="flex items-start justify-between mb-5">
        <div class="flex items-center gap-3">
          <span
            class="w-10 h-10 rounded-lg grid place-items-center"
            style="background: var(--info-bg); color: var(--info)"
          >
            <KeyRound :size="20" />
          </span>
          <div>
            <h2 class="text-[15px] font-semibold text-ink-1">设备上报 Token</h2>
            <p class="text-[12px] text-ink-4 mt-0.5">
              ESP32 通过 HTTP Header <code class="px-1 rounded bg-surface-hover">Authorization: Bearer &lt;Token&gt;</code> 上报数据
            </p>
          </div>
        </div>
        <FluentBadge status="info" dot>已启用</FluentBadge>
      </div>

      <div class="space-y-3">
        <div class="flex items-center gap-3 p-3 rounded-fluent" style="background: var(--bg-card-2)">
          <span class="text-[13px] text-ink-3 w-20">当前 Token</span>
          <code class="flex-1 font-mono text-[14px] text-ink-1 tracking-wider">
            {{ tokenLoading ? '••••••••' : tokenMasked || '—' }}
          </code>
          <button
            class="w-8 h-8 rounded-fluent grid place-items-center text-ink-3 hover:bg-surface-hover transition-colors"
            title="复制"
            @click="copyMasked"
          >
            <Check v-if="copied" :size="15" class="text-success" />
            <Copy v-else :size="15" />
          </button>
        </div>
        <div class="text-[12px] text-ink-4">
          最后更新：{{ tokenUpdatedAt ? fmtDateTime(tokenUpdatedAt) : '—' }}
        </div>
      </div>

      <!-- 重置表单 -->
      <div v-if="showReset" class="mt-4 p-4 rounded-fluent border" style="border-color: var(--warning); background: var(--warning-bg)">
        <div class="flex items-center gap-2 mb-3 text-warning">
          <AlertTriangle :size="16" />
          <span class="text-[13px] font-medium">重置后旧 Token 立即失效，请同步更新到所有 ESP32 设备</span>
        </div>
        <div class="flex items-end gap-3">
          <FluentInput
            v-model="newToken"
            label="新 Token"
            placeholder="至少 6 个字符"
            class="flex-1"
          />
          <FluentButton variant="primary" :loading="resetting" @click="submitReset">
            <Check :size="15" />
            确认重置
          </FluentButton>
          <FluentButton variant="standard" @click="showReset = false">取消</FluentButton>
        </div>
      </div>

      <div v-else class="mt-4">
        <FluentButton variant="standard" @click="openReset">
          <RefreshCw :size="15" />
          重置 Token
        </FluentButton>
      </div>

      <div
        v-if="resetMsg && !showReset"
        class="mt-3 px-3 py-2 rounded-fluent text-[13px]"
        :style="{
          background: resetMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: resetMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
        }"
      >
        {{ resetMsg.text }}
      </div>
    </div>

    <!-- 设备列表 -->
    <div class="fluent-card p-6 fade-up">
      <div class="flex items-center gap-3 mb-5">
        <span
          class="w-10 h-10 rounded-lg grid place-items-center"
          style="background: var(--info-bg); color: var(--info)"
        >
          <Cpu :size="20" />
        </span>
        <div>
          <h2 class="text-[15px] font-semibold text-ink-1">已接入设备</h2>
          <p class="text-[12px] text-ink-4 mt-0.5">共 {{ devices.length }} 台设备曾上报数据</p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[12px] text-ink-3 border-b" style="background: var(--bg-card-2)">
              <th class="px-3 py-2.5 font-medium">设备 ID</th>
              <th class="px-3 py-2.5 font-medium">最后活跃</th>
              <th class="px-3 py-2.5 font-medium">上报次数</th>
              <th class="px-3 py-2.5 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="devicesLoading">
              <td colspan="4" class="px-3 py-10 text-center text-ink-3">
                <div class="spinner mx-auto" />
              </td>
            </tr>
            <tr v-else-if="!devices.length">
              <td colspan="4" class="px-3 py-10 text-center text-ink-4">暂无设备</td>
            </tr>
            <tr
              v-for="d in devices"
              :key="d.device_id"
              class="border-b hover:bg-surface-hover transition-colors"
              style="border-color: var(--stroke)"
            >
              <td class="px-3 py-2.5 text-ink-1 font-medium">{{ d.device_id }}</td>
              <td class="px-3 py-2.5 text-ink-2">
                {{ timeAgo(d.last_seen) }}
                <span class="text-[11px] text-ink-4 ml-1">({{ fmtDateTime(d.last_seen) }})</span>
              </td>
              <td class="px-3 py-2.5 tabular-nums text-ink-2">{{ d.count }}</td>
              <td class="px-3 py-2.5">
                <FluentBadge
                  :status="Date.now() - new Date(d.last_seen).getTime() < 90_000 ? 'success' : 'neutral'"
                  dot
                >
                  {{ Date.now() - new Date(d.last_seen).getTime() < 90_000 ? '在线' : '离线' }}
                </FluentBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 账号信息 -->
    <div class="fluent-card p-6 fade-up">
      <div class="flex items-center gap-3 mb-4">
        <span
          class="w-10 h-10 rounded-lg grid place-items-center"
          style="background: var(--success-bg); color: var(--success)"
        >
          <ShieldCheck :size="20" />
        </span>
        <h2 class="text-[15px] font-semibold text-ink-1">管理员账号</h2>
      </div>
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="text-[12px] text-ink-4 mb-1">账号</div>
          <div class="text-ink-1 font-medium">{{ auth.username || 'admin' }}</div>
        </div>
        <div>
          <div class="text-[12px] text-ink-4 mb-1">角色</div>
          <FluentBadge status="info">管理员</FluentBadge>
        </div>
      </div>
      <p class="mt-4 text-[12px] text-ink-4">
        账号密码存于数据库 <code class="px-1 rounded bg-surface-hover">users</code> 表（bcrypt 哈希加密），修改密码请执行 <code class="px-1 rounded bg-surface-hover">schema.sql</code> 末尾的 UPDATE 语句
      </p>
    </div>
  </div>
</template>
