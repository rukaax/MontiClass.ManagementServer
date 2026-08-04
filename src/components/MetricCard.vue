<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

const props = defineProps<{
  label: string
  value: string | number | null
  unit?: string
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  icon?: Component
  hint?: string
  loading?: boolean
}>()

const statusColor = computed(() => {
  switch (props.status) {
    case 'success': return 'var(--success)'
    case 'warning': return 'var(--warning)'
    case 'danger': return 'var(--danger)'
    case 'info': return 'var(--info)'
    default: return 'var(--text-4)'
  }
})

function onMove(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--rx', `${e.clientX - r.left}px`)
  el.style.setProperty('--ry', `${e.clientY - r.top}px`)
}
</script>

<template>
  <div
    class="reveal fluent-card hoverable p-5 fade-up flex flex-col gap-3"
    @mousemove="onMove"
  >
    <div class="flex items-center justify-between">
      <span class="text-[13px] font-medium text-ink-3">{{ label }}</span>
      <span
        v-if="icon"
        class="w-8 h-8 rounded-lg grid place-items-center"
        :style="{ background: `color-mix(in srgb, ${statusColor} 14%, transparent)`, color: statusColor }"
      >
        <component :is="icon" :size="18" />
      </span>
    </div>

    <div v-if="loading" class="h-9 w-24 rounded bg-surface-hover animate-pulse" />
    <div v-else class="flex items-baseline gap-1.5">
      <span class="text-[32px] font-semibold leading-none text-ink-1 tabular-nums">
        {{ value ?? '—' }}
      </span>
      <span v-if="unit" class="text-sm text-ink-3">{{ unit }}</span>
    </div>

    <div v-if="hint" class="text-[12px] text-ink-4">{{ hint }}</div>
  </div>
</template>
