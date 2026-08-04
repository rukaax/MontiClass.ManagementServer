<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GraduationCap, User, Lock, LogIn } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import FluentButton from '@/components/FluentButton.vue'
import FluentInput from '@/components/FluentInput.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请输入账号和密码'
    return
  }
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.replace(redirect)
  } catch (e: any) {
    error.value = e?.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen mica-bg grid place-items-center p-6 relative overflow-hidden">
    <!-- 装饰光晕 -->
    <div
      class="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl"
      style="background: radial-gradient(circle, var(--fluent-primary), transparent 70%)"
    />
    <div
      class="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full opacity-20 blur-3xl"
      style="background: radial-gradient(circle, #107C10, transparent 70%)"
    />

    <div class="relative w-full max-w-md fade-up">
      <div class="text-center mb-7">
        <div
          class="inline-grid place-items-center w-14 h-14 rounded-2xl text-white shadow-f16 mb-4"
          style="background: linear-gradient(135deg, var(--fluent-primary), #005a9e)"
        >
          <GraduationCap :size="28" />
        </div>
        <h1 class="text-2xl font-semibold text-ink-1">智能教室环境监测</h1>
        <p class="text-sm text-ink-3 mt-1">ESP32S3 · 管理控制台</p>
      </div>

      <form
        @submit.prevent="submit"
        class="acrylic-strong rounded-fluent-xl border p-7 shadow-f16"
        style="border-color: var(--stroke)"
      >
        <div class="space-y-4">
          <div>
            <label class="block mb-1.5 text-[13px] font-medium text-ink-2">账号</label>
            <div class="relative">
              <User :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
              <FluentInput
                v-model="username"
                placeholder="请输入管理员账号"
                autocomplete="username"
                class="block"
              />
            </div>
          </div>
          <div>
            <label class="block mb-1.5 text-[13px] font-medium text-ink-2">密码</label>
            <div class="relative">
              <Lock :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
              <FluentInput
                v-model="password"
                type="password"
                placeholder="请输入密码"
                autocomplete="current-password"
              />
            </div>
          </div>
        </div>

        <div
          v-if="error"
          class="mt-4 px-3 py-2 rounded-fluent text-[13px] text-danger"
          style="background: var(--danger-bg)"
        >
          {{ error }}
        </div>

        <FluentButton
          variant="primary"
          size="lg"
          type="submit"
          :loading="loading"
          class="w-full mt-6"
        >
          <LogIn :size="17" />
          登 录
        </FluentButton>

        <p class="mt-5 text-center text-[12px] text-ink-4">
          默认账号密码请在 <code class="px-1 py-0.5 rounded bg-surface-hover">.env</code> 中配置
        </p>
      </form>
    </div>
  </div>
</template>

<style scoped>
:deep(input) {
  padding-left: 2.25rem !important;
}
</style>
