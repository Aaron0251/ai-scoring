import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      redirect: '/dashboard',
    },
    // ── 管理員 ──────────────────────────────────
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/admin/AdminUsers.vue'),
      meta: { featureKey: 'admin-users' },
    },
    {
      path: '/admin/org',
      name: 'admin-org',
      component: () => import('../views/admin/AdminOrg.vue'),
      meta: { featureKey: 'admin-org' },
    },
    {
      path: '/admin/config',
      name: 'admin-config',
      component: () => import('../views/admin/AdminConfig.vue'),
      meta: { featureKey: 'admin-config' },
    },
    {
      path: '/admin/role-permissions',
      name: 'admin-role-permissions',
      component: () => import('../views/admin/AdminRolePermissions.vue'),
      meta: { featureKey: 'admin-role-permissions' },
    },
    // ── 場景管理 ────────────────────────────────
    {
      path: '/scenes',
      name: 'scenes',
      component: () => import('../views/SceneListView.vue'),
      meta: { featureKey: 'scenes' },
    },
    {
      path: '/scenes/:id',
      name: 'scene-detail',
      component: () => import('../views/SceneDetailView.vue'),
      meta: { featureKey: 'scenes' },
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('../views/ImportView.vue'),
      meta: { featureKey: 'import' },
    },
    // ── 種子負責人追蹤 ─────────────────────────
    {
      path: '/leader-tracking',
      name: 'leader-tracking',
      component: () => import('../views/LeaderTrackingView.vue'),
      meta: { featureKey: 'leader-tracking' },
    },
    {
      path: '/leader-tracking/scene/:id',
      name: 'leader-scene-detail',
      component: () => import('../views/LeaderSceneDetailView.vue'),
      meta: { featureKey: 'leader-tracking' },
    },
    // ── 個人 ────────────────────────────────────
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
    },
    // ── 404 ─────────────────────────────────────
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { public: true },
    },
  ],
})

// ── 路由守衛 ──────────────────────────────────
router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.meta.public) return next()

  if (!auth.isLoggedIn) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (auth.user?.mustChangePassword && to.name !== 'profile') {
    return next({ name: 'profile' })
  }

  // admin 永遠放行所有路由
  if (auth.isAdmin) return next()

  // 非 admin 才檢查動態功能權限
  if (to.meta.featureKey && !auth.hasFeature(to.meta.featureKey)) {
    return next({ name: 'dashboard' })
  }

  next()
})

export default router
