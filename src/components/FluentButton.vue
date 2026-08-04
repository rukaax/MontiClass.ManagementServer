<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'standard' | 'subtle' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'standard', size: 'md', type: 'button' },
)

const cls = computed(() => [
  'fbtn inline-flex items-center justify-center gap-2 font-medium rounded-fluent',
  'transition-all ease-fluent duration-150 select-none whitespace-nowrap',
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-fluent-primary/60',
  props.size === 'sm'
    ? 'h-8 px-3 text-[13px]'
    : props.size === 'lg'
      ? 'h-11 px-6 text-[15px]'
      : 'h-9 px-4 text-sm',
  props.variant === 'primary' &&
    'bg-fluent-primary text-white hover:bg-fluent-primary-hover active:bg-fluent-primary-pressed shadow-f2',
  props.variant === 'standard' &&
    'bg-surface-card text-ink-1 border border-stroke-strong hover:bg-surface-hover active:bg-surface-pressed shadow-f2',
  props.variant === 'subtle' &&
    'bg-transparent text-ink-1 hover:bg-surface-hover active:bg-surface-pressed',
  props.variant === 'danger' &&
    'bg-danger text-white hover:brightness-110 active:brightness-95 shadow-f2',
  (props.disabled || props.loading) && 'opacity-50 cursor-not-allowed',
])
</script>

<template>
  <button :type="type" :class="cls" :disabled="disabled || loading">
    <span v-if="loading" class="spinner" />
    <slot />
  </button>
</template>

<style scoped>
.fbtn {
  border-radius: var(--radius-md);
}
</style>
