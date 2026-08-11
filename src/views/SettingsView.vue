<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  KeyRound,
  Cpu,
  ShieldCheck,
  Check,
  RefreshCw,
  AlertTriangle,
  Lock,
} from 'lucide-vue-next'
import { api, type DeviceInfo } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import FluentButton from '@/components/FluentButton.vue'
import FluentInput from '@/components/FluentInput.vue'
import FluentBadge from '@/components/FluentBadge.vue'
import { fmtDateTime, timeAgo } from '@/lib/format'

const auth = useAuthStore()

// ===== Token =====
const tokenMasked = ref('')
const tokenUpdatedAt = ref<string | null>(null)
const tokenLoading = ref(true)
const showRotate = ref(false)
const rotating = ref(false)
const rotatedToken = ref('') // 轮换后的完整明文，仅显示一次

// ===== 修改密码 =====
const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const changingPw = ref(false)
const pwMsg = ref<{ type: 'success' | 'error'; text: string } | null>(null)

// ===== 设备 =====
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

function isOnlineAt(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 90_000
}

async function doRotate() {
  rotating.value = true
  try {
    const res = await api.rotateToken()
    rotatedToken.value = res.data.token
    showRotate.value = false
    await fetchToken()
  } catch (e: any) {
    alert(e?.message || '轮换失败')
  } finally {
    rotating.value = false
  }
}

function dismissRotated() {
  rotatedToken.value = ''
}

async function submitPassword() {
  pwMsg.value = null
  if (!pwCurrent.value) {
    pwMsg.value = { type: 'error', text: '请输入当前密码' }
    return
  }
  if (pwNew.value.length < 6) {
    pwMsg.value = { type: 'error', text: '新密码至少 6 个字符' }
    return
  }
  if (pwNew.value !== pwConfirm.value) {
    pwMsg.value = { type: 'error', text: '两次输入的新密码不一致' }
    return
  }
  if (pwNew.value === pwCurrent.value) {
    pwMsg.value = { type: 'error', text: '新密码不能与当前密码相同' }
    return
  }
  changingPw.value = true
  try {
    await api.changePassword(pwCurrent.value, pwNew.value)
    pwMsg.value = { type: 'success', text: '密码修改成功，下次登录请使用新密码' }
    pwCurrent.value = ''
    pwNew.value = ''
    pwConfirm.value = ''
  } catch (e: any) {
    pwMsg.value = { type: 'error', text: e?.message || '修改失败' }
  } finally {
    changingPw.value = false
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
    <div class="fluent-card p-4 sm:p-6 fade-up">
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
        <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 rounded-fluent" style="background: var(--bg-card-2)">
          <span class="text-[12px] text-ink-4 sm:text-[13px] sm:text-ink-3 sm:w-20">当前 Token</span>
          <code class="font-mono text-[13px] sm:text-[14px] text-ink-1 tracking-wider select-all break-all">
            {{ tokenLoading ? '••••••••' : tokenMasked || '—' }}
          </code>
        </div>
        <div class="text-[12px] text-ink-4">
          最后更新：{{ tokenUpdatedAt ? fmtDateTime(tokenUpdatedAt) : '—' }}
        </div>
      </div>

      <!-- 轮换后的新 Token（明文，仅显示一次） -->
      <div
        v-if="rotatedToken"
        class="mt-4 p-4 rounded-fluent border"
        style="border-color: var(--success); background: var(--success-bg)"
      >
        <div class="flex items-center gap-2 mb-2 text-success">
          <Check :size="16" />
          <span class="text-[13px] font-medium">Token 已轮换，请立即选中下方文本复制保存（仅显示一次）</span>
        </div>
        <div class="flex items-center gap-3">
          <code class="flex-1 font-mono text-[14px] text-ink-1 tracking-wider break-all select-all">
            {{ rotatedToken }}
          </code>
        </div>
        <div class="mt-3 flex justify-end">
          <FluentButton variant="standard" @click="dismissRotated">我已保存</FluentButton>
        </div>
      </div>

      <!-- 轮换确认 -->
      <div
        v-else-if="showRotate"
        class="mt-4 p-4 rounded-fluent border"
        style="border-color: var(--warning); background: var(--warning-bg)"
      >
        <div class="flex items-center gap-2 mb-3 text-warning">
          <AlertTriangle :size="16" />
          <span class="text-[13px] font-medium">
            将随机生成新 Token，旧 Token 立即失效。请确认已准备好同步到所有 ESP32 设备
          </span>
        </div>
        <div class="flex items-center gap-3">
          <FluentButton variant="primary" :loading="rotating" @click="doRotate">
            <RefreshCw :size="15" />
            确认轮换
          </FluentButton>
          <FluentButton variant="standard" @click="showRotate = false">取消</FluentButton>
        </div>
      </div>

      <div v-else-if="auth.role === 'admin'" class="mt-4">
        <FluentButton variant="standard" @click="showRotate = true">
          <RefreshCw :size="15" />
          轮换 Token
        </FluentButton>
      </div>
    </div>

    <!-- 修改密码 -->
    <div v-if="auth.role === 'admin'" class="fluent-card p-4 sm:p-6 fade-up">
      <div class="flex items-center gap-3 mb-5">
        <span
          class="w-10 h-10 rounded-lg grid place-items-center"
          style="background: var(--accent-bg, var(--info-bg)); color: var(--accent, var(--info))"
        >
          <Lock :size="20" />
        </span>
        <div>
          <h2 class="text-[15px] font-semibold text-ink-1">修改管理员密码</h2>
          <p class="text-[12px] text-ink-4 mt-0.5">新密码以 bcrypt 哈希存储于数据库 users 表</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FluentInput
          v-model="pwCurrent"
          type="password"
          label="当前密码"
          placeholder="输入当前密码"
          autocomplete="current-password"
        />
        <FluentInput
          v-model="pwNew"
          type="password"
          label="新密码"
          placeholder="至少 6 个字符"
          autocomplete="new-password"
        />
        <FluentInput
          v-model="pwConfirm"
          type="password"
          label="确认新密码"
          placeholder="再次输入新密码"
          autocomplete="new-password"
        />
      </div>

      <div class="mt-4 flex items-center gap-3">
        <FluentButton variant="primary" :loading="changingPw" @click="submitPassword">
          <Check :size="15" />
          保存新密码
        </FluentButton>
        <div
          v-if="pwMsg"
          class="px-3 py-2 rounded-fluent text-[13px]"
          :style="{
            background: pwMsg.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: pwMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
          }"
        >
          {{ pwMsg.text }}
        </div>
      </div>
    </div>

    <!-- 设备列表 -->
    <div class="fluent-card p-4 sm:p-6 fade-up">
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

      <!-- 移动端：设备卡片 -->
      <div class="sm:hidden">
        <div v-if="devicesLoading" class="py-10 text-center text-ink-3">
          <div class="spinner mx-auto" />
        </div>
        <div v-else-if="!devices.length" class="py-10 text-center text-ink-4">暂无设备</div>
        <div v-else>
          <div
            v-for="d in devices"
            :key="d.device_id"
            class="p-3 border-b"
            style="border-color: var(--stroke)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-[14px] font-medium text-ink-1">{{ d.device_id }}</span>
              <FluentBadge :status="isOnlineAt(d.last_seen) ? 'success' : 'neutral'" dot>
                {{ isOnlineAt(d.last_seen) ? '在线' : '离线' }}
              </FluentBadge>
            </div>
            <div class="mt-1.5 flex items-center justify-between text-[12px] text-ink-3">
              <span>{{ timeAgo(d.last_seen) }}</span>
              <span class="tabular-nums">{{ d.count }} 次上报</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 桌面端：表格 -->
      <div class="overflow-x-auto hidden sm:block">
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
    <div class="fluent-card p-4 sm:p-6 fade-up">
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
          <FluentBadge :status="auth.role === 'viewer' ? 'info' : 'info'">{{ auth.role === 'viewer' ? '只读用户' : '管理员' }}</FluentBadge>
        </div>
      </div>
      <p class="mt-4 text-[12px] text-ink-4">
        账号密码存于数据库 <code class="px-1 rounded bg-surface-hover">users</code> 表（bcrypt 哈希加密），可在上方「修改管理员密码」卡片中直接修改
      </p>
    </div>
  </div>
</template>
