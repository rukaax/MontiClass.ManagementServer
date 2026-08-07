<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { Download } from 'lucide-vue-next'
import { api, type StatsPoint, type DeviceInfo } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import FluentButton from '@/components/FluentButton.vue'
import FluentSelect from '@/components/FluentSelect.vue'
import BaseChart from '@/components/BaseChart.vue'
import { trendLineOption, METRIC_META } from '@/lib/chartOptions'
import { toLocalInput } from '@/lib/format'

const ui = useUiStore()

const devices = ref<DeviceInfo[]>([])
const deviceId = ref('')
const preset = ref('24h')
const granularity = ref<'hour' | 'day'>('hour')
const start = ref(toLocalInput(new Date(Date.now() - 24 * 3600 * 1000)))
const end = ref(toLocalInput(new Date()))
const loading = ref(false)

// 各指标数据
const metricData = reactive<Record<string, StatsPoint[]>>({})
const metricEntries = Object.entries(METRIC_META)

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
    const sIso = toIso(start.value)
    const eIso = toIso(end.value)
    const results = await Promise.all(
      metricEntries.map(([k]) =>
        api
          .stats({
            metric: k,
            granularity: granularity.value,
            deviceId: deviceId.value || undefined,
            start: sIso,
            end: eIso,
          })
          .then((r) => [k, r.data.points] as const)
          .catch(() => [k, [] as StatsPoint[]] as const),
      ),
    )
    for (const [k, pts] of results) metricData[k] = pts
  } finally {
    loading.value = false
  }
}

function chartOption(key: string) {
  const meta = METRIC_META[key]
  const points = metricData[key] || []
  if (!points.length) return null
  return trendLineOption({
    points,
    name: meta.label,
    unit: meta.unit,
    color: meta.color,
    area: true,
    zoom: true,
  })
}

// 收集各图表实例，用于导出
const chartRefs = ref<any[]>([])
const exporting = ref(false)

function setChartRef(el: any, idx: number) {
  if (el) chartRefs.value[idx] = el
}

/** 一键导出：把所有图表拼成一张 PNG 下载 */
async function exportAll() {
  const targets = metricEntries
    .map(([key, m], idx) => ({
    label: m.label,
    url: chartRefs.value[idx]?.getDataURL?.() || '',
  }))
    .filter((t) => t.url)

  if (!targets.length) return
  exporting.value = true
  try {
    const imgs = await Promise.all(
      targets.map(
        (t) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = t.url
          }),
      ),
    )

    const padX = 24
    const gap = 20
    const titleH = 30
    const contentW = Math.max(...imgs.map((i) => i.width))
    const totalH = imgs.reduce((s, img) => s + titleH + img.height + gap, gap)

    const canvas = document.createElement('canvas')
    canvas.width = contentW + padX * 2
    canvas.height = totalH
    const ctx = canvas.getContext('2d')!
    const bg =
      getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() ||
      '#ffffff'
    const txt =
      getComputedStyle(document.documentElement).getPropertyValue('--text-1').trim() ||
      '#333333'
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    let y = gap
    imgs.forEach((img, idx) => {
      ctx.fillStyle = txt
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText(targets[idx].label, padX, y + 18)
      y += titleH
      ctx.drawImage(img, padX + (contentW - img.width) / 2, y)
      y += img.height + gap
    })

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `charts_${new Date().toISOString().slice(0, 10)}.png`
      a.click()
      URL.revokeObjectURL(url)
    })
  } finally {
    exporting.value = false
  }
}

watch(() => ui.isDark, load)

onMounted(async () => {
  await fetchDevices()
  await load()
})
</script>

<template>
  <div class="space-y-5">
    <!-- 控制栏（精简） -->
    <div class="fluent-card p-4 fade-up">
      <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3 sm:gap-4">
        <FluentSelect v-model="deviceId" label="设备" class="w-full sm:w-40" @update:modelValue="load">
          <option value="">全部设备</option>
          <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
            {{ d.device_id }}
          </option>
        </FluentSelect>

        <div class="flex flex-wrap items-end gap-1.5">
          <span class="block mb-1.5 text-[13px] font-medium text-ink-2 mr-1">时间</span>
          <FluentButton size="sm" :variant="preset === '24h' ? 'primary' : 'standard'" @click="applyPreset('24h')">
            近 24h
          </FluentButton>
          <FluentButton size="sm" :variant="preset === '7d' ? 'primary' : 'standard'" @click="applyPreset('7d')">
            近 7d
          </FluentButton>
          <FluentButton size="sm" :variant="preset === '30d' ? 'primary' : 'standard'" @click="applyPreset('30d')">
            近 30d
          </FluentButton>
        </div>

        <FluentButton
          variant="standard"
          :loading="exporting"
          :disabled="exporting || loading"
          class="w-full sm:w-auto sm:ml-auto"
          @click="exportAll"
        >
          <Download :size="15" />
          导出图表
        </FluentButton>
      </div>
    </div>

    <!-- 6 个指标小图表网格（一行俩） -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="([key, m], idx) in metricEntries"
        :key="key"
        class="fluent-card p-4 fade-up"
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: m.color }" />
          <h3 class="text-[13px] font-semibold text-ink-1">{{ m.label }}</h3>
          <span class="text-[11px] text-ink-4 ml-auto">单位：{{ m.unit }}</span>
        </div>
        <BaseChart :ref="(el: any) => setChartRef(el, idx)" :option="chartOption(key)" :loading="loading" height="230px" />
      </div>
    </div>
  </div>
</template>
