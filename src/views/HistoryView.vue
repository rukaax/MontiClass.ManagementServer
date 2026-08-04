<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Download, Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-vue-next'
import { api, type ReportRow, type DeviceInfo } from '@/api/client'
import FluentButton from '@/components/FluentButton.vue'
import FluentSelect from '@/components/FluentSelect.vue'
import FluentBadge from '@/components/FluentBadge.vue'
import { fmtDateTime, fmtNum, toLocalInput } from '@/lib/format'

const devices = ref<DeviceInfo[]>([])
const items = ref<ReportRow[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const loading = ref(false)

const deviceId = ref('')
const defaultStart = new Date(Date.now() - 24 * 3600 * 1000)
const defaultEnd = new Date()
const start = ref(toLocalInput(defaultStart))
const end = ref(toLocalInput(defaultEnd))

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))

function toIso(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

async function fetchDevices() {
  try {
    const res = await api.devices()
    devices.value = res.data
  } catch {
    /* ignore */
  }
}

async function search() {
  page.value = 1
  await load()
}

async function load() {
  loading.value = true
  try {
    const res = await api.history({
      deviceId: deviceId.value || undefined,
      start: toIso(start.value),
      end: toIso(end.value),
      page: page.value,
      size: size.value,
    })
    items.value = res.data.items
    total.value = res.data.total
  } catch (e) {
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
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
  const cols = ['上报时间', '设备ID', '光敏1', '光敏2', 'AQI', '温度(°C)', '风速(m/s)', '是否有人']
  const rows = items.value.map((r) => [
    fmtDateTime(r.reported_at),
    r.device_id,
    r.light1 ?? '',
    r.light2 ?? '',
    r.aqi ?? '',
    r.temperature ?? '',
    r.speed ?? '',
    r.presence == null ? '' : r.presence ? '有人' : '无人',
  ])
  const csv = [cols, ...rows]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `history_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await fetchDevices()
  await load()
})
</script>

<template>
  <div class="space-y-5">
    <!-- 筛选栏 -->
    <div class="fluent-card p-4 fade-up">
      <div class="flex flex-wrap items-end gap-4">
        <FluentSelect v-model="deviceId" label="设备" class="w-44">
          <option value="">全部设备</option>
          <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
            {{ d.device_id }}
          </option>
        </FluentSelect>

        <label class="block">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">开始时间</span>
          <input
            v-model="start"
            type="datetime-local"
            class="h-9 px-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30"
          />
        </label>

        <label class="block">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">结束时间</span>
          <input
            v-model="end"
            type="datetime-local"
            class="h-9 px-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30"
          />
        </label>

        <FluentSelect v-model="size" label="每页" class="w-28" @update:modelValue="search">
          <option :value="20">20 条</option>
          <option :value="50">50 条</option>
          <option :value="100">100 条</option>
        </FluentSelect>

        <div class="flex gap-2">
          <FluentButton variant="primary" @click="search">
            <Search :size="15" />
            查询
          </FluentButton>
          <FluentButton variant="standard" @click="exportCsv" :disabled="!items.length">
            <Download :size="15" />
            导出 CSV
          </FluentButton>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="fluent-card overflow-hidden fade-up">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[12px] text-ink-3 border-b" style="background: var(--bg-card-2)">
              <th class="px-4 py-3 font-medium">上报时间</th>
              <th class="px-4 py-3 font-medium">设备 ID</th>
              <th class="px-4 py-3 font-medium">光敏 1</th>
              <th class="px-4 py-3 font-medium">光敏 2</th>
              <th class="px-4 py-3 font-medium">AQI</th>
              <th class="px-4 py-3 font-medium">温度</th>
              <th class="px-4 py-3 font-medium">风速</th>
              <th class="px-4 py-3 font-medium">是否有人</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-16 text-center text-ink-3">
                <div class="flex flex-col items-center gap-3">
                  <div class="spinner" />
                  <span>加载中…</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="!items.length">
              <td colspan="8" class="px-4 py-16 text-center text-ink-3">
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
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ r.light1 ?? '—' }}</td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ r.light2 ?? '—' }}</td>
              <td class="px-4 py-3">
                <FluentBadge :status="aqiStatus(r.aqi)">{{ r.aqi ?? '—' }}</FluentBadge>
              </td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ fmtNum(r.temperature) }} °C</td>
              <td class="px-4 py-3 tabular-nums text-ink-2">{{ fmtNum(r.speed) }} m/s</td>
              <td class="px-4 py-3">
                <FluentBadge :status="r.presence ? 'info' : 'neutral'" dot>
                  {{ r.presence == null ? '—' : r.presence ? '有人' : '无人' }}
                </FluentBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="flex items-center justify-between px-4 py-3 border-t" style="border-color: var(--stroke)">
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
  </div>
</template>
