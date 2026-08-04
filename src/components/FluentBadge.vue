<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
    dot?: boolean
  }>(),
  { status: 'neutral' },
)

const map = {
  success: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  warning: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  danger: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  info: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  neutral: { bg: 'var(--bg-hover)', fg: 'var(--text-3)' },
} as const

const style = computed(() => ({
  background: map[props.status].bg,
  color: map[props.status].fg,
}))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium leading-5"
    :style="style"
  >
    <span
      v-if="dot"
      class="w-1.5 h-1.5 rounded-full"
      :style="{ background: map[status].fg }"
    />
    <slot />
  </span>
</template>
