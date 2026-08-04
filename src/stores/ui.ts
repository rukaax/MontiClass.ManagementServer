import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const stored = localStorage.getItem('theme')
  const isDark = ref(
    stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  function apply() {
    document.documentElement.classList.toggle('dark', isDark.value)
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  }

  function toggle() {
    isDark.value = !isDark.value
  }

  watch(isDark, apply, { immediate: true })

  return { isDark, toggle }
})
