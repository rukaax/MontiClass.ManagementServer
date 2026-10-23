<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Download, Search, ChevronLeft, ChevronRight, Inbox, Radio, Calendar, AlertTriangle } from 'lucide-vue-next'
import { api, type ReportRow, type DeviceInfo } from '@/api/client'
import FluentButton from '@/components/FluentButton.vue'
import FluentSelect from '@/components/FluentSelect.vue'
import FluentBadge from '@/components/FluentBadge.vue'
import { fmtDateTime, fmtNum } from '@/lib/format'

const devices = ref<DeviceInfo[]>([])
const items = ref<ReportRow[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)
const errorMsg = ref('')

const deviceId = ref('')
const startDate = ref('') // 空 = 不限起始
const endDate = ref('') // 空 = 不限结束

const hasRange = computed(() => !!(startDate.value || endDate.value))
const isRealtime = computed(() => !hasRange.value)
const rangeLabel = computed(() => {
  if (startDate.value && endDate.value) return `${startDate.value} ~ ${endDate.value}`
  if (startDate.value) return `${startDate.value} 起`
  return `截至 ${endDate.value}`
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))

async function fetchDevices() {
  try {
    const res = await api.devices()
    devices.value = res.data
  } catch (e: any) {
    errorMsg.value = e?.message || '加载设备列表失败'
  }
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    let startIso: string | undefined
    let endIso: string | undefined
    if (startDate.value) {
      const s = new Date(`${startDate.value}T00:00:00`)
      if (!isNaN(s.getTime())) startIso = s.toISOString()
    }
    if (endDate.value) {
      const e = new Date(`${endDate.value}T23:59:59.999`)
      if (!isNaN(e.getTime())) endIso = e.toISOString()
    }
    if (startIso && endIso && startIso > endIso) {
      items.value = []
      total.value = 0
      errorMsg.value = '起始日期不能晚于结束日期'
      return
    }
    const res = await api.history({
      deviceId: deviceId.value || undefined,
      start: startIso,
      end: endIso,
      page: page.value,
      size: size.value,
    })
    items.value = res.data.items
    total.value = res.data.total
  } catch (e: any) {
    items.value = []
    total.value = 0
    errorMsg.value = e?.message || '加载历史数据失败'
  } finally {
    loading.value = false
  }
}

async function search() {
  page.value = 1
  await load()
}

function clearRange() {
  startDate.value = ''
  endDate.value = ''
  search()
}

function go(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  load()
}

function aqiStatus(v: number | null) {
  if (v == null) return 'neutral' as const
  if (v <= 50) return 'success' as const
  if (v <= 100) return 'warning' as const
  return 'danger' as const
}

function exportCsv() {
  const cols = ['上报时间', '设备ID', '光敏1(%)', '光敏2(%)', '光敏1 ADC', '光敏2 ADC', 'AQI', '温度(°C)', '湿度(%)', '是否有人']
  const rows = items.value.map((r) => [
    fmtDateTime(r.reported_at),
    r.device_id,
    r.light1 ?? '',
    r.light2 ?? '',
    r.light1_adc ?? '',
    r.light2_adc ?? '',
    r.aqi ?? '',
    r.temperature ?? '',
    r.humidity ?? '',
    r.presence == null ? '' : r.presence ? '有人' : '无人',
  ])
  const csv = [cols, ...rows]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `history_${startDate.value || 'all'}_${endDate.value || 'now'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// 实时模式（无日期范围）每 10 秒自动刷新
let timer: number | undefined
onMounted(async () => {
  await fetchDevices()
  await load()
  timer = window.setInterval(() => {
    if (!hasRange.value) load()
  }, 10000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="space-y-4 sm:space-y-5">
    <!-- 错误提示横幅 -->
    <div
      v-if="errorMsg"
      class="fluent-card p-3 fade-up flex items-center gap-3"
      style="border-color: var(--danger)"
    >
      <AlertTriangle :size="18" class="shrink-0" style="color: var(--danger)" />
      <span class="text-sm text-ink-1 flex-1">{{ errorMsg }}</span>
      <button
        class="shrink-0 w-6 h-6 rounded grid place-items-center text-ink-3 hover:text-ink-1 hover:bg-surface-hover transition-colors"
        @click="errorMsg = ''"
      >
        ×
      </button>
    </div>

    <!-- 筛选栏（移动端网格堆叠） -->
    <div class="fluent-card p-4 fade-up">
      <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
        <FluentSelect v-model="deviceId" label="设备" class="w-full sm:w-44" @update:modelValue="search">
          <option value="">全部设备</option>
          <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
            {{ d.device_id }}
          </option>
        </FluentSelect>

        <label class="block">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">起始日期</span>
          <div class="relative">
            <Calendar :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
            <input
              v-model="startDate"
              type="date"
              placeholder="不选=不限"
              class="w-full h-9 pl-8 pr-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30"
            />
          </div>
        </label>

        <label class="block">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">结束日期</span>
          <div class="relative">
            <Calendar :size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
            <input
              v-model="endDate"
              type="date"
              placeholder="不选=不限"
              class="w-full h-9 pl-8 pr-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30"
            />
          </div>
        </label>

        <FluentSelect v-model="size" label="每页" class="w-full sm:w-28" @update:modelValue="search">
          <option :value="20">20 条</option>
          <option :value="50">50 条</option>
          <option :value="100">100 条</option>
        </FluentSelect>

        <div class="col-span-2 sm:col-span-1 flex gap-2 sm:items-end">
          <FluentButton variant="primary" @click="search">
            <Search :size="15" />
            查询
          </FluentButton>
          <FluentButton variant="standard" @click="exportCsv" :disabled="!items.length">
            <Download :size="15" />
            导出
          </FluentButton>
          <FluentButton v-if="hasRange" variant="subtle" @click="clearRange">
            清除日期
          </FluentButton>
        </div>

        <div class="col-span-2 sm:ml-auto flex items-center">
          <FluentBadge v-if="isRealtime" status="success" dot>
            <span class="flex items-center gap-1">
              <Radio :size="12" class="animate-pulse" />
              实时 · 每 10s 刷新
            </span>
          </FluentBadge>
          <FluentBadge v-else status="info" dot>
            <span class="flex items-center gap-1">
              <Calendar :size="12" />
              历史 · {{ rangeLabel }}
            </span>
          </FluentBadge>
        </div>
      </div>
    </div>

    <!-- 移动端：卡片列表 -->
    <div class="fluent-card overflow-hidden fade-up sm:hidden">
      <div v-if="loading" class="py-16 text-center text-ink-3">
        <div class="flex flex-col items-center gap-3">
          <div class="spinner" />
          <span>加载中…</span>
        </div>
      </div>
      <div v-else-if="!items.length" class="py-16 text-center text-ink-3">
        <div class="flex flex-col items-center gap-3">
          <Inbox :size="32" class="text-ink-4" />
          <span>暂无数据</span>
        </div>
      </div>
      <div v-else>
        <div
          v-for="r in items"
          :key="r.id"
          class="p-3 border-b"
          style="border-color: var(--stroke)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[12px] text-ink-4 tabular-nums">{{ fmtDateTime(r.reported_at) }}</span>
            <FluentBadge :status="r.presence ? 'info' : 'neutral'" dot>
              {{ r.presence == null ? '—' : r.presence ? '有人' : '无人' }}
            </FluentBadge>
          </div>
          <div class="mt-1 text-[13px] font-medium text-ink-1">{{ r.device_id }}</div>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <div>
              <div class="text-[11px] text-ink-4">光敏1</div>
              <div class="text-[13px] text-ink-1 tabular-nums">{{ fmtNum(r.light1) }}%</div>
            </div>
            <div>
              <div class="text-[11px] text-ink-4">光敏2</div>
              <div class="text-[13px] text-ink-1 tabular-nums">{{ fmtNum(r.light2) }}%</div>
            </div>
            <div>
              <div class="text-[11px] text-ink-4">AQI</div>
              <div class="text-[13px] tabular-nums" :style="{ color: r.aqi == null ? '' : 'var(--text-1)' }">
                <FluentBadge :status="aqiStatus(r.aqi)">{{ r.aqi ?? '—' }}</FluentBadge>
              </div>
            </div>
            <div>
              <div class="text-[11px] text-ink-4">温度</div>
              <div class="text-[13px] text-ink-1 tabular-nums">{{ fmtNum(r.temperature) }}°</div>
            </div>
            <div>
              <div class="text-[11px] text-ink-4">湿度</div>
              <div class="text-[13px] text-ink-1 tabular-nums">{{ fmtNum(r.humidity) }}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌面端：表格 -->
    <div class="fluent-card overflow-hidden fade-up hidden sm:block">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[12px] text-ink-3 border-b" style="background: var(--bg-card-2)">
              <th class="px-4 py-3 font-medium">上报时间</th>
              <th class="px-4 py-3 font-medium">设备 ID</th>
              <th class="px-4 py-3 font-medium">光敏 1</th>
              <th class="px-4 py-3 font-medium">光敏 2</th>
              <th class="px-4 py-3 font-medium hidden md:table-cell">光敏1 ADC</th>
              <th class="px-4 py-3 font-medium hidden md:table-cell">光敏2 ADC</th>
              <th class="px-4 py-3 font-medium">AQI</th>
              <th class="px-4 py-3 font-medium">温度</th>
              <th class="px-4 py-3 font-medium">湿度</th>
              <th class="px-4 py-3 font-medium">是否有人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="10" class="px-4 py-16 text-center text-ink-3">
                <div class="flex flex-col items-center gap-3">
                  <div class="spinner" />
                  <span>加载中…</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="10" class="px-4 py-16 text-center text-ink-3">
                <div class="flex flex-col items-center gap-3">
                  <Inbox :size="32" class="text-ink-4" />
                  <span>暂无数据</span>
                </div>
              </td>
            </tr>
            <tr
              v-for="r in items"
              :key="r.id"
              class="border-b transition-colors hover:bg-surface-hover"
              style="border-color: var(--stroke)"
            >
              <td class="px-4 py-3 text-ink-1 tabular-nums">{{ fmtDateTime(r.reported_at) }}</td>
              <td class="px-4 py-3 text-ink-2">{{ r.device_id }}</td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ fmtNum(r.light1) }} %</td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ fmtNum(r.light2) }} %</td>
              <td class="px-4 py-3 tabular-nums text-ink-3 hidden md:table-cell">{{ r.light1_adc ?? '—' }}</td>
              <td class="px-4 py-3 tabular-nums text-ink-3 hidden md:table-cell">{{ r.light2_adc ?? '—' }}</td>
              <td class="px-4 py-3">
                <FluentBadge :status="aqiStatus(r.aqi)">{{ r.aqi ?? '—' }}</FluentBadge>
              </td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ fmtNum(r.temperature) }} °C</td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ fmtNum(r.humidity) }} %</td>
              <td class="px-4 py-3">
                <FluentBadge :status="r.presence ? 'info' : 'neutral'" dot>
                  {{ r.presence == null ? '—' : r.presence ? '有人' : '无人' }}
                </FluentBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 分页 -->
    <div class="fluent-card flex items-center justify-between px-4 py-3">
      <span class="text-[13px] text-ink-3">
        共 <span class="font-medium text-ink-1">{{ total }}</span> 条 · 第
        <span class="font-medium text-ink-1">{{ page }}</span> / {{ totalPages }} 页
      </span>
      <div class="flex gap-1">
        <button
          class="w-8 h-8 rounded-fluent grid place-items-center text-ink-2 hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          :disabled="page <= 1"
          @click="go(page - 1)"
        >
          <ChevronLeft :size="16" />
        </button>
        <button
          class="w-8 h-8 rounded-fluent grid place-items-center text-ink-2 hover:bg-surface-hover disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          :disabled="page >= totalPages"
          @click="go(page + 1)"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
  </div>
</template>
