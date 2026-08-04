<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'

defineProps<{
  modelValue?: string | number
  label?: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="block mb-1.5 text-[13px] font-medium text-ink-2">{{ label }}</span>
    <div class="relative">
      <select
        :value="modelValue"
        :disabled="disabled"
        @change="onChange"
        class="w-full h-9 pl-3 pr-9 rounded-fluent bg-surface-card text-ink-1 text-sm
          border border-stroke-strong transition-all ease-fluent duration-150 appearance-none
          focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30
          disabled:opacity-50 cursor-pointer"
      >
        <slot />
      </select>
      <ChevronDown :size="16" class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
    </div>
  </label>
</template>
