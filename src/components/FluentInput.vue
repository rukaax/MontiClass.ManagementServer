<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    type?: string
    placeholder?: string
    error?: string
    disabled?: boolean
    autocomplete?: string
  }>(),
  { type: 'text' },
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="block">
    <span v-if="label" class="block mb-1.5 text-[13px] font-medium text-ink-2">{{ label }}</span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :autocomplete="autocomplete"
      @input="onInput"
      class="w-full h-9 px-3 rounded-fluent bg-surface-card text-ink-1 text-sm
        border transition-all ease-fluent duration-150
        placeholder:text-ink-4
        focus:outline-none focus:border-fluent-primary focus:ring-2 focus:ring-fluent-primary/30"
      :class="error ? 'border-danger' : 'border-stroke-strong'"
    />
    <span v-if="error" class="block mt-1 text-[12px] text-danger">{{ error }}</span>
  </label>
</template>
