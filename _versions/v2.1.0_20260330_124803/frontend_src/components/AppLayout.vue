<template>
  <el-container class="layout">
    <!-- 側邊欄 -->
    <el-aside width="220px" class="sidebar">
      <div class="logo">AI 推動評分 v2</div>
      <el-menu :default-active="activeMenu" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>總覽</span>
        </el-menu-item>
        <el-menu-item index="/scenes">
          <el-icon><Document /></el-icon>
          <span>場景管理</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isAdmin || auth.isManager" index="/import">
          <el-icon><Upload /></el-icon>
          <span>Excel 匯入</span>
        </el-menu-item>

        <el-sub-menu v-if="auth.isAdmin || auth.isExecutive || auth.isChief" index="eval">
          <template #title>
            <el-icon><Star /></el-icon>
            <span>推動評核</span>
          </template>
          <el-menu-item index="/periods">期別管理</el-menu-item>
          <el-menu-item index="/score-report">評核報表</el-menu-item>
        </el-sub-menu>

        <el-menu-item v-if="auth.isEvaluator || auth.isAdmin" index="/score">
          <el-icon><EditPen /></el-icon>
          <span>我的評分</span>
        </el-menu-item>

        <el-sub-menu v-if="auth.isAdmin || auth.isExecutive || auth.isChief" index="eff">
          <template #title>
            <el-icon><TrendCharts /></el-icon>
            <span>效率評估</span>
          </template>
          <el-menu-item index="/efficiency">期別管理</el-menu-item>
          <el-menu-item index="/efficiency/score">效率評分</el-menu-item>
        </el-sub-menu>

        <el-sub-menu v-if="auth.isAdmin" index="admin">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系統管理</span>
          </template>
          <el-menu-item index="/admin/users">使用者管理</el-menu-item>
          <el-menu-item index="/admin/org">組織架構</el-menu-item>
          <el-menu-item index="/admin/config">系統設定</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- 主區域 -->
    <el-container>
      <el-header class="topbar">
        <div class="topbar-right">
          <span class="username">{{ auth.user?.name }}</span>
          <el-dropdown @command="handleCommand">
            <el-icon style="cursor:pointer; margin-left:8px"><User /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">個人設定</el-dropdown-item>
                <el-dropdown-item command="logout" divided>登出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const activeMenu = computed(() => route.path)

function handleCommand(cmd) {
  if (cmd === 'logout') {
    auth.logout()
    router.push('/login')
  } else if (cmd === 'profile') {
    router.push('/profile')
  }
}
</script>

<style scoped>
.layout { height: 100vh; overflow: hidden; }
.sidebar { background: #1a1f2e; display: flex; flex-direction: column; }
.logo {
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  padding: 20px 16px;
  border-bottom: 1px solid #2d3346;
}
.side-menu { border-right: none; background: #1a1f2e; flex: 1; }
.side-menu :deep(.el-menu-item),
.side-menu :deep(.el-sub-menu__title) {
  color: #b0b8d4;
}
.side-menu :deep(.el-menu-item.is-active) {
  color: #fff;
  background: #2d3346 !important;
}
.topbar {
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 24px;
}
.topbar-right { display: flex; align-items: center; gap: 8px; }
.username { font-size: 14px; color: #555; }
.main-content { overflow-y: auto; background: #f5f7fa; padding: 24px; }
</style>
