<script setup lang="ts">
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import '@/lib/echarts'

const props = withDefaults(
  defineProps<{
    option: any
    height?: string
    loading?: boolean
  }>(),
  { height: '320px' },
)

const style = computed(() => ({ height: props.height, width: '100%' }))
const vchartRef = ref<any>(null)

/** 导出当前图表为 PNG dataURL */
function getDataURL(): string {
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() ||
    '#ffffff'
  return (
    vchartRef.value?.getDataURL?.({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: bg,
    }) || ''
  )
}

defineExpose({ getDataURL })
</script>

<template>
  <div v-if="loading" class="w-full grid place-items-center" :style="{ height }">
    <div class="spinner" />
  </div>
  <VChart v-else ref="vchartRef" :option="option" :style="style" autoresize />
</template>
