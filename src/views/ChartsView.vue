<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { LineChart, BarChart3, TrendingUp } from 'lucide-vue-next'
import { api, type StatsPoint, type DeviceInfo } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import FluentButton from '@/components/FluentButton.vue'
import FluentSelect from '@/components/FluentSelect.vue'
import BaseChart from '@/components/BaseChart.vue'
import { readVar, METRIC_META } from '@/lib/chartOptions'
import { fmtDateTime, toLocalInput } from '@/lib/format'

const ui = useUiStore()

const devices = ref<DeviceInfo[]>([])
const deviceId = ref('')
const metric = ref('temperature')
const granularity = ref<'hour' | 'day'>('hour')
const points = ref<StatsPoint[]>([])
const loading = ref(false)

const preset = ref('24h')
const start = ref(toLocalInput(new Date(Date.now() - 24 * 3600 * 1000)))
const end = ref(toLocalInput(new Date()))

function toIso(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

function applyPreset(p: string) {
  preset.value = p
  const now = new Date()
  let s: Date
  if (p === '24h') {
    s = new Date(now.getTime() - 24 * 3600 * 1000)
    granularity.value = 'hour'
  } else if (p === '7d') {
    s = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    granularity.value = 'day'
  } else {
    s = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
    granularity.value = 'day'
  }
  start.value = toLocalInput(s)
  end.value = toLocalInput(now)
  load()
}

async function fetchDevices() {
  try {
    const res = await api.devices()
    devices.value = res.data
  } catch {
    /* ignore */
  }
}

async function load() {
  loading.value = true
  try {
    const res = await api.stats({
      metric: metric.value,
      granularity: granularity.value,
      deviceId: deviceId.value || undefined,
      start: toIso(start.value),
      end: toIso(end.value),
    })
    points.value = res.data.points
  } catch {
    points.value = []
  } finally {
    loading.value = false
  }
}

const meta = computed(() => METRIC_META[metric.value])

const trendOption = computed(() => {
  if (!points.value.length) return null
  const color = meta.value.color
  const x = points.value.map((p) => fmtDateTime(p.t))
  return {
    grid: { left: 52, right: 24, top: 24, bottom: 56 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: readVar('--bg-card'),
      borderColor: readVar('--stroke-strong'),
      textStyle: { color: readVar('--text-1'), fontSize: 12 },
      valueFormatter: (v: any) =>
        v == null ? '—' : `${Number(v).toFixed(1)} ${meta.value.unit}`,
    },
    xAxis: {
      type: 'category', data: x, boundaryGap: false,
      axisLine: { lineStyle: { color: readVar('--stroke-strong') } },
      axisLabel: { color: readVar('--text-3'), fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: readVar('--stroke-strong') } },
      axisLabel: { color: readVar('--text-3'), fontSize: 11 },
      splitLine: { lineStyle: { color: readVar('--stroke') } },
      axisTick: { show: false },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider', height: 18, bottom: 12,
        borderColor: 'transparent',
        backgroundColor: readVar('--bg-hover'),
        fillerColor: `color-mix(in srgb, ${color} 18%, transparent)`,
        handleStyle: { color },
        textStyle: { color: readVar('--text-3') },
      },
    ],
    series: [
      {
        name: '平均值',
        type: 'line',
        data: points.value.map((p) => (p.avg == null ? null : Number(p.avg))),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `color-mix(in srgb, ${color} 28%, transparent)` },
              { offset: 1, color: `color-mix(in srgb, ${color} 2%, transparent)` },
            ],
          },
        },
      },
    ],
  }
})

const rangeOption = computed(() => {
  if (!points.value.length) return null
  const x = points.value.map((p) => fmtDateTime(p.t))
  return {
    grid: { left: 52, right: 24, top: 40, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: readVar('--bg-card'),
      borderColor: readVar('--stroke-strong'),
      textStyle: { color: readVar('--text-1'), fontSize: 12 },
      valueFormatter: (v: any) =>
        v == null ? '—' : `${Number(v).toFixed(1)} ${meta.value.unit}`,
    },
    legend: {
      top: 4, icon: 'roundRect',
      textStyle: { color: readVar('--text-2'), fontSize: 12 },
    },
    xAxis: {
      type: 'category', data: x, boundaryGap: true,
      axisLine: { lineStyle: { color: readVar('--stroke-strong') } },
      axisLabel: { color: readVar('--text-3'), fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: readVar('--stroke-strong') } },
      axisLabel: { color: readVar('--text-3'), fontSize: 11 },
      splitLine: { lineStyle: { color: readVar('--stroke') } },
      axisTick: { show: false },
    },
    series: [
      {
        name: '最高值',
        type: 'line',
        data: points.value.map((p) => (p.max == null ? null : Number(p.max))),
        smooth: true, showSymbol: false,
        lineStyle: { width: 2, color: '#D13438', type: 'dashed' },
        itemStyle: { color: '#D13438' },
      },
      {
        name: '最低值',
        type: 'line',
        data: points.value.map((p) => (p.min == null ? null : Number(p.min))),
        smooth: true, showSymbol: false,
        lineStyle: { width: 2, color: '#0078D4', type: 'dashed' },
        itemStyle: { color: '#0078D4' },
      },
    ],
  }
})

watch(metric, load)
watch(() => ui.isDark, load)

onMounted(async () => {
  await fetchDevices()
  await load()
})
</script>

<template>
  <div class="space-y-5">
    <!-- 控制栏 -->
    <div class="fluent-card p-4 fade-up">
      <div class="flex flex-wrap items-end gap-4">
        <FluentSelect v-model="metric" label="指标" class="w-40">
          <option v-for="(m, k) in METRIC_META" :key="k" :value="k">{{ m.label }}</option>
        </FluentSelect>

        <FluentSelect v-model="deviceId" label="设备" class="w-40" @update:modelValue="load">
          <option value="">全部设备</option>
          <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
            {{ d.device_id }}
          </option>
        </FluentSelect>

        <FluentSelect v-model="granularity" label="粒度" class="w-32" @update:modelValue="load">
          <option value="hour">按小时</option>
          <option value="day">按天</option>
        </FluentSelect>

        <div class="flex gap-1.5">
          <FluentButton size="sm" :variant="preset === '24h' ? 'primary' : 'standard'" @click="applyPreset('24h')">
            近 24 小时
          </FluentButton>
          <FluentButton size="sm" :variant="preset === '7d' ? 'primary' : 'standard'" @click="applyPreset('7d')">
            近 7 天
          </FluentButton>
          <FluentButton size="sm" :variant="preset === '30d' ? 'primary' : 'standard'" @click="applyPreset('30d')">
            近 30 天
          </FluentButton>
        </div>

        <label class="block">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">开始</span>
          <input v-model="start" type="datetime-local"
            class="h-9 px-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30" />
        </label>
        <label class="block">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2">结束</span>
          <input v-model="end" type="datetime-local"
            class="h-9 px-3 rounded-fluent bg-surface-card text-ink-1 text-sm border border-stroke-strong focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30" />
        </label>

        <FluentButton variant="primary" @click="load">
          <TrendingUp :size="15" />
          应用
        </FluentButton>
      </div>
    </div>

    <!-- 趋势图 -->
    <div class="fluent-card p-5 fade-up">
      <div class="flex items-center gap-2 mb-4">
        <LineChart :size="18" class="text-fluent-primary" />
        <h2 class="text-[15px] font-semibold text-ink-1">
          {{ meta.label }} · 平均值趋势
        </h2>
        <span class="text-[12px] text-ink-4">（单位：{{ meta.unit }}）</span>
      </div>
      <BaseChart :option="trendOption" :loading="loading" height="340px" />
    </div>

    <!-- 最高/最低对比 -->
    <div class="fluent-card p-5 fade-up">
      <div class="flex items-center gap-2 mb-4">
        <BarChart3 :size="18" class="text-fluent-primary" />
        <h2 class="text-[15px] font-semibold text-ink-1">
          {{ meta.label }} · 最高 / 最低对比
        </h2>
      </div>
      <BaseChart :option="rangeOption" :loading="loading" height="300px" />
    </div>
  </div>
</template>
