<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  History,
  BarChart3,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  GraduationCap,
  Bot,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import FluentButton from '@/components/FluentButton.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

const nav = [
  { name: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { name: 'history', label: '历史', icon: History },
  { name: 'charts', label: '图表', icon: BarChart3 },
  { name: 'ai', label: 'AI 助手', icon: Bot },
  { name: 'settings', label: '设置', icon: SettingsIcon },
]

const title = computed(() => {
  const n = route.name as string
  return nav.find((x) => x.name === n)?.label || '智能教室环境监测'
})

function logout() {
  auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex h-screen mica-bg overflow-hidden">
    <!-- 侧边导航（桌面） -->
    <aside
      class="hidden md:flex acrylic w-64 shrink-0 border-r border-stroke flex-col"
      style="border-color: var(--stroke)"
    >
      <div class="h-14 flex items-center gap-2.5 px-5 border-b" style="border-color: var(--stroke)">
        <div
          class="w-8 h-8 rounded-lg grid place-items-center text-white shadow-f2"
          style="background: linear-gradient(135deg, var(--fluent-primary), #005a9e)"
        >
          <GraduationCap :size="18" />
        </div>
        <div class="leading-tight">
          <div class="text-[14px] font-semibold text-ink-1">智能教室</div>
          <div class="text-[11px] text-ink-4">环境监测平台</div>
        </div>
      </div>

      <nav class="flex-1 p-2.5 space-y-1">
        <router-link
          v-for="item in nav"
          :key="item.name"
          :to="{ name: item.name }"
          class="group flex items-center gap-3 h-10 px-3 rounded-fluent text-sm transition-all ease-fluent duration-150"
          :class="
            route.name === item.name
              ? 'bg-fluent-primary-tint text-fluent-primary font-semibold'
              : 'text-ink-2 hover:bg-surface-hover'
          "
        >
          <span
            class="w-1 h-5 rounded-full transition-all"
            :style="{
              background:
                route.name === item.name ? 'var(--fluent-primary)' : 'transparent',
            }"
          />
          <component :is="item.icon" :size="18" />
          {{ item.label }}
        </router-link>
      </nav>

      <div class="p-3 border-t text-[11px] text-ink-4" style="border-color: var(--stroke)">
        ESP32S3 · v0.1.0
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶部命令栏 -->
      <header
        class="acrylic h-14 shrink-0 border-b flex items-center gap-3 px-4 md:gap-4 md:px-6"
        style="border-color: var(--stroke)"
      >
        <div class="flex items-center gap-2 md:hidden">
          <div
            class="w-7 h-7 rounded-md grid place-items-center text-white"
            style="background: linear-gradient(135deg, var(--fluent-primary), #005a9e)"
          >
            <GraduationCap :size="16" />
          </div>
        </div>
        <h1 class="text-[15px] font-semibold text-ink-1 truncate">{{ title }}</h1>
        <div class="flex-1" />

        <button
          class="w-9 h-9 rounded-fluent grid place-items-center text-ink-2 hover:bg-surface-hover transition-colors shrink-0"
          :title="ui.isDark ? '切换到浅色' : '切换到深色'"
          @click="ui.toggle()"
        >
          <Sun v-if="ui.isDark" :size="18" />
          <Moon v-else :size="18" />
        </button>

        <div class="hidden sm:block h-6 w-px" style="background: var(--stroke-strong)" />

        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-full grid place-items-center text-white text-[13px] font-semibold shrink-0"
            style="background: linear-gradient(135deg, var(--fluent-primary), #005a9e)"
          >
            {{ (auth.username || 'A').slice(0, 1).toUpperCase() }}
          </div>
          <div class="hidden sm:block leading-tight">
            <div class="text-[13px] font-medium text-ink-1">{{ auth.username || 'admin' }}</div>
            <div class="text-[11px] text-ink-4">{{ auth.role === 'viewer' ? '只读用户' : '管理员' }}</div>
          </div>
        </div>

        <FluentButton variant="subtle" size="sm" @click="logout" class="shrink-0">
          <LogOut :size="15" />
          <span class="hidden sm:inline">退出</span>
        </FluentButton>
      </header>

      <!-- 内容 -->
      <main class="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 底部导航（移动端） -->
    <nav
      class="md:hidden fixed bottom-0 inset-x-0 acrylic border-t flex items-stretch h-14 z-50"
      style="border-color: var(--stroke)"
    >
      <router-link
        v-for="item in nav"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] transition-colors"
        :class="
          route.name === item.name
            ? 'text-fluent-primary font-semibold'
            : 'text-ink-3 hover:text-ink-1'
        "
      >
        <component :is="item.icon" :size="20" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
