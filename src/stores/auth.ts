import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

/** 解析 JWT payload（仅前端用于判过期，不做签名校验） */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

/** token 为空或已过期（含解析失败）返回 true */
function isTokenExpired(token: string | null): boolean {
  if (!token) return true
  const payload = decodeJwtPayload(token)
  if (!payload) return true
  if (!payload.exp) return false // 无 exp 字段不判过期
  return Date.now() >= payload.exp * 1000
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'))
  const username = ref<string | null>(localStorage.getItem('admin_user'))
  const role = ref<'admin' | 'viewer' | null>(
    (localStorage.getItem('admin_role') as 'admin' | 'viewer') || null,
  )

  // 关键修复：不仅检查 token 存在，还要检查未过期，避免残留失效 token 直接进面板
  const isAuthenticated = computed(
    () => !!token.value && !isTokenExpired(token.value),
  )

  async function login(user: string, pass: string): Promise<void> {
    const res = await api.login(user, pass)
    token.value = res.token
    username.value = res.username
    role.value = res.role
    localStorage.setItem('admin_token', res.token)
    localStorage.setItem('admin_user', res.username)
    localStorage.setItem('admin_role', res.role)
  }

  function logout(): void {
    token.value = null
    username.value = null
    role.value = null
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    localStorage.removeItem('admin_role')
  }

  /** 供 401 拦截器调用：清除失效 token，使 isAuthenticated 立即变 false */
  function clearInvalid(): void {
    token.value = null
    localStorage.removeItem('admin_token')
  }

  return { token, username, role, isAuthenticated, login, logout, clearInvalid }
})
