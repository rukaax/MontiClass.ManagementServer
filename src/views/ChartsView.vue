<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
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
  })
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
      <div class="flex flex-wrap items-end gap-4">
        <FluentSelect v-model="deviceId" label="设备" class="w-40" @update:modelValue="load">
          <option value="">全部设备</option>
          <option v-for="d in devices" :key="d.device_id" :value="d.device_id">
            {{ d.device_id }}
          </option>
        </FluentSelect>

        <div class="flex items-end gap-1.5">
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
      </div>
    </div>

    <!-- 6 个指标小图表网格 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="[key, m] in metricEntries"
        :key="key"
        class="fluent-card p-4 fade-up"
      >
        <div class="flex items-center gap-2 mb-2">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: m.color }" />
          <h3 class="text-[13px] font-semibold text-ink-1">{{ m.label }}</h3>
          <span class="text-[11px] text-ink-4 ml-auto">单位：{{ m.unit }}</span>
        </div>
        <BaseChart :option="chartOption(key)" :loading="loading" height="190px" />
      </div>
    </div>
  </div>
</template>
