<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Sun,
  Lightbulb,
  Wind,
  Thermometer,
  UserCheck,
  RefreshCw,
  Radio,
  Cpu,
} from 'lucide-vue-next'
import { api, type ReportRow, type DeviceInfo } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import MetricCard from '@/components/MetricCard.vue'
import FluentBadge from '@/components/FluentBadge.vue'
import FluentSelect from '@/components/FluentSelect.vue'
import BaseChart from '@/components/BaseChart.vue'
import { trendLineOption, METRIC_META } from '@/lib/chartOptions'
import { fmtNum, timeAgo, fmtDateTime } from '@/lib/format'

const ui = useUiStore()

const latest = ref<ReportRow | null>(null)
const devices = ref<DeviceInfo[]>([])
const selectedDevice = ref<string>('')
const loadingLatest = ref(true)
const refreshing = ref(false)
const lastUpdated = ref<Date | null>(null)

const trendMetric = ref('temperature')
const trendLoading = ref(false)
const trendOption = ref<any>(null)

let timer: number | undefined

const isOnline = computed(() => {
  if (!latest.value) return false
  const t = new Date(latest.value.reported_at).getTime()
  return Date.now() - t < 90_000
})

function aqiStatus(v: number | null) {
  if (v == null) return 'neutral' as const
  if (v <= 50) return 'success' as const
  if (v <= 100) return 'warning' as const
  return 'danger' as const
}
function aqiText(v: number | null) {
  if (v == null) return '—'
  if (v <= 50) return '优'
  if (v <= 100) return '良'
  if (v <= 150) return '轻度污染'
  if (v <= 200) return '中度污染'
  return '重度污染'
}
function tempStatus(v: number | null) {
  if (v == null) return 'neutral' as const
  if (v >= 18 && v <= 26) return 'success' as const
  if (v < 10 || v > 30) return 'danger' as const
  return 'warning' as const
}

async function fetchDevices() {
  try {
    const res = await api.devices()
    devices.value = res.data
    if (!selectedDevice.value && devices.value[0]) {
      selectedDevice.value = devices.value[0].device_id
    }
  } catch (e) {
    /* ignore */
  }
}

async function fetchLatest() {
  loadingLatest.value = !lastUpdated.value
  refreshing.value = !!lastUpdated.value
  try {
    const res = await api.latest(selectedDevice.value || undefined)
    latest.value = res.data
    lastUpdated.value = new Date()
  } catch (e) {
    /* ignore */
  } finally {
    loadingLatest.value = false
    refreshing.value = false
  }
}

async function fetchTrend() {
  trendLoading.value = true
  try {
    const end = new Date()
    const start = new Date(end.getTime() - 24 * 3600 * 1000)
    const res = await api.stats({
      metric: trendMetric.value,
      granularity: 'hour',
      deviceId: selectedDevice.value || undefined,
      start: start.toISOString(),
      end: end.toISOString(),
    })
    const meta = METRIC_META[trendMetric.value]
    trendOption.value = trendLineOption({
      points: res.data.points,
      name: meta.label,
      unit: meta.unit,
      color: meta.color,
      area: true,
    })
  } catch (e) {
    /* ignore */
  } finally {
    trendLoading.value = false
  }
}

async function refreshAll() {
  await Promise.all([fetchLatest(), fetchTrend()])
}

watch(selectedDevice, () => {
  fetchLatest()
  fetchTrend()
})
watch(trendMetric, fetchTrend)
watch(() => ui.isDark, () => fetchTrend())

onMounted(async () => {
  await fetchDevices()
  await refreshAll()
  timer = window.setInterval(refreshAll, 15_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="space-y-6">
    <!-- 设备状态条 -->
    <div class="fluent-card p-4 flex flex-wrap items-center gap-4 fade-up">
      <div class="flex items-center gap-2.5">
        <span
          class="w-2.5 h-2.5 rounded-full"
          :class="isOnline ? 'pulse-dot' : ''"
          :style="{ background: isOnline ? 'var(--success)' : 'var(--text-4)' }"
        />
        <FluentBadge :status="isOnline ? 'success' : 'neutral'" dot>
          {{ isOnline ? '在线' : '离线' }}
        </FluentBadge>
      </div>

      <div class="h-5 w-px" style="background: var(--stroke-strong)" />

      <div class="flex items-center gap-2 text-sm text-ink-2">
        <Cpu :size="15" class="text-ink-3" />
        <span class="text-ink-3">设备：</span>
        <span class="font-medium text-ink-1">{{ latest?.device_id || '—' }}</span>
      </div>

      <div class="flex items-center gap-2 text-sm text-ink-2">
        <Radio :size="15" class="text-ink-3" />
        <span class="text-ink-3">最后上报：</span>
        <span class="font-medium text-ink-1">{{ timeAgo(latest?.reported_at) }}</span>
      </div>

      <div class="flex-1" />

      <FluentSelect v-model="selectedDevice" size="sm" class="w-44">
        <option value="">全部设备</option>
        <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
          {{ d.device_id }}
        </option>
      </FluentSelect>

      <button
        class="w-9 h-9 rounded-fluent grid place-items-center text-ink-2 hover:bg-surface-hover transition-colors"
        :class="refreshing ? 'animate-spin' : ''"
        title="刷新"
        @click="refreshAll"
      >
        <RefreshCw :size="16" />
      </button>
    </div>

    <!-- 指标卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        label="光敏 1"
        :value="loadingLatest ? null : fmtNum(latest?.light1)"
        unit="%"
        :icon="Sun"
        status="warning"
        :hint="`亮度百分比 · ADC ${latest?.light1_adc ?? '—'}`"
        :loading="loadingLatest"
      />
      <MetricCard
        label="光敏 2"
        :value="loadingLatest ? null : fmtNum(latest?.light2)"
        unit="%"
        :icon="Lightbulb"
        status="warning"
        :hint="`亮度百分比 · ADC ${latest?.light2_adc ?? '—'}`"
        :loading="loadingLatest"
      />
      <MetricCard
        label="空气质量指数"
        :value="loadingLatest ? null : fmtNum(latest?.aqi, 0)"
        unit="AQI"
        :icon="Wind"
        :status="aqiStatus(latest?.aqi ?? null)"
        :hint="aqiText(latest?.aqi ?? null)"
        :loading="loadingLatest"
      />
      <MetricCard
        label="温度"
        :value="loadingLatest ? null : fmtNum(latest?.temperature)"
        unit="°C"
        :icon="Thermometer"
        :status="tempStatus(latest?.temperature ?? null)"
        :hint="tempStatus(latest?.temperature ?? null) === 'success' ? '舒适' : '需关注'"
        :loading="loadingLatest"
      />
      <MetricCard
        label="是否有人"
        :value="loadingLatest ? null : latest?.presence ? '有人' : '无人'"
        :icon="UserCheck"
        :status="latest?.presence ? 'info' : 'neutral'"
        hint="人体存在检测"
        :loading="loadingLatest"
      />
    </div>

    <!-- 趋势图 -->
    <div class="fluent-card p-5 fade-up">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-[15px] font-semibold text-ink-1">最近 24 小时趋势</h2>
          <p class="text-[12px] text-ink-4 mt-0.5">
            更新于 {{ lastUpdated ? fmtDateTime(lastUpdated.toISOString()) : '—' }}
          </p>
        </div>
        <FluentSelect v-model="trendMetric" class="w-40">
          <option v-for="(meta, key) in METRIC_META" :key="key" :value="key">
            {{ meta.label }}
          </option>
        </FluentSelect>
      </div>
      <BaseChart :option="trendOption" :loading="trendLoading" height="320px" />
    </div>
  </div>
</template>
