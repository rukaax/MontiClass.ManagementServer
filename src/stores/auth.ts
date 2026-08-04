import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'))
  const username = ref<string | null>(localStorage.getItem('admin_user'))

  const isAuthenticated = computed(() => !!token.value)

  async function login(user: string, pass: string): Promise<void> {
    const res = await api.login(user, pass)
    token.value = res.token
    username.value = res.username
    localStorage.setItem('admin_token', res.token)
    localStorage.setItem('admin_user', res.username)
  }

  function logout(): void {
    token.value = null
    username.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  }

  return { token, username, isAuthenticated, login, logout }
})
