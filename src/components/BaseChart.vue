<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <div v-if="loading" class="w-full grid place-items-center" :style="{ height }">
    <div class="spinner" />
  </div>
  <VChart v-else :option="option" :style="style" autoresize />
</template>
