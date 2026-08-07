<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GraduationCap, LogIn, AlertCircle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import FluentInput from '@/components/FluentInput.vue'
import FluentButton from '@/components/FluentButton.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请输入账号和密码'
    return
  }
  errorMsg.value = ''
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
  } catch (e: any) {
    errorMsg.value = e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen mica-bg grid place-items-center p-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="flex flex-col items-center mb-6">
        <div
          class="w-14 h-14 rounded-2xl grid place-items-center text-white shadow-f2 mb-3"
          style="background: linear-gradient(135deg, var(--fluent-primary), #005a9e)"
        >
          <GraduationCap :size="28" />
        </div>
        <h1 class="text-xl font-semibold text-ink-1">智能教室</h1>
        <p class="text-sm text-ink-4 mt-0.5">环境监测平台</p>
      </div>

      <!-- 登录卡片 -->
      <form class="fluent-card p-6 space-y-4 fade-up" @submit.prevent="onSubmit">
        <FluentInput
          v-model="username"
          label="账号"
          placeholder="请输入账号"
          autocomplete="username"
          :disabled="loading"
        />
        <FluentInput
          v-model="password"
          label="密码"
          type="password"
          placeholder="请输入密码"
          autocomplete="current-password"
          :disabled="loading"
        />

        <div
          v-if="errorMsg"
          class="flex items-start gap-2 p-2.5 rounded-fluent text-[13px]"
          style="background: rgba(208, 59, 47, 0.08); color: var(--danger)"
        >
          <AlertCircle :size="16" class="shrink-0 mt-0.5" />
          <span>{{ errorMsg }}</span>
        </div>

        <FluentButton
          variant="primary"
          type="submit"
          :loading="loading"
          :disabled="loading"
          class="w-full"
        >
          <LogIn :size="16" />
          登录
        </FluentButton>
      </form>

      <p class="text-center text-[12px] text-ink-4 mt-4">
        ESP32S3 · 智能教室环境监测系统
      </p>
    </div>
  </div>
</template>
