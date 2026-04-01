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
      meta: { roles: ['admin', 'manager', 'executive', 'chief'] },
    },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/admin/AdminUsers.vue'),
      meta: { roles: ['admin'] },
    },
    {
      path: '/admin/org',
      name: 'admin-org',
      component: () => import('../views/admin/AdminOrg.vue'),
      meta: { roles: ['admin'] },
    },
    {
      path: '/admin/config',
      name: 'admin-config',
      component: () => import('../views/admin/AdminConfig.vue'),
      meta: { roles: ['admin'] },
    },
    // ── 場景管理 ────────────────────────────────
    {
      path: '/scenes',
      name: 'scenes',
      component: () => import('../views/SceneListView.vue'),
      meta: { roles: ['admin', 'manager', 'executive', 'chief', 'evaluator'] },
    },
    {
      path: '/scenes/:id',
      name: 'scene-detail',
      component: () => import('../views/SceneDetailView.vue'),
      meta: { roles: ['admin', 'manager', 'executive', 'chief', 'evaluator'] },
    },
    {
      path: '/import',
      name: 'import',
      component: () => import('../views/ImportView.vue'),
      meta: { roles: ['admin', 'manager'] },
    },
    // ── 評核 ────────────────────────────────────
    {
      path: '/periods',
      name: 'periods',
      component: () => import('../views/PeriodsView.vue'),
      meta: { roles: ['admin', 'executive', 'chief'] },
    },
    {
      path: '/score',
      name: 'score',
      component: () => import('../views/ScoreView.vue'),
      meta: { roles: ['evaluator', 'admin'] },
    },
    {
      path: '/score-report',
      name: 'score-report',
      component: () => import('../views/ScoreReportView.vue'),
      meta: { roles: ['admin', 'executive', 'chief'] },
    },
    // ── 效率評估 ────────────────────────────────
    {
      path: '/efficiency',
      name: 'efficiency',
      component: () => import('../views/EfficiencyView.vue'),
      meta: { roles: ['admin', 'executive', 'chief'] },
    },
    {
      path: '/efficiency/score',
      name: 'efficiency-score',
      component: () => import('../views/EfficiencyScoreView.vue'),
      meta: { roles: ['evaluator', 'admin'] },
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

  if (to.meta.roles) {
    const allowed = to.meta.roles.some(r => auth.hasRole(r))
    if (!allowed) return next({ name: 'dashboard' })
  }

  next()
})

export default router
