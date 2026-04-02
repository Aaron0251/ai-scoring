import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/index.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(sessionStorage.getItem('token') || null)
  const user = ref(JSON.parse(sessionStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.roles?.includes('admin') ?? false)
  const isManager = computed(() => user.value?.roles?.includes('manager') ?? false)
  const isBoss = computed(() => user.value?.roles?.includes('boss') ?? false)
  const isEvaluator = computed(() => user.value?.roles?.includes('evaluator') ?? false)
  const isChief = computed(() => user.value?.roles?.includes('chief') ?? false)
  const isExecutive = computed(() => user.value?.roles?.includes('executive') ?? false)
  const hasRole = (role) => user.value?.roles?.includes(role) ?? false

  // 動態功能權限
  const allowedFeatures = computed(() => user.value?.allowedFeatures ?? [])
  const hasFeature = (featureKey) => {
    // admin 擁有所有功能（防止鎖死）
    if (isAdmin.value) return true
    return allowedFeatures.value.includes(featureKey)
  }

  async function login(username, password) {
    const res = await authApi.login({ username, password })
    token.value = res.data.token
    user.value = res.data.user
    sessionStorage.setItem('token', token.value)
    sessionStorage.setItem('user', JSON.stringify(user.value))
    return res.data
  }

  function logout() {
    token.value = null
    user.value = null
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  async function fetchMe() {
    const res = await authApi.me()
    user.value = res.data
    sessionStorage.setItem('user', JSON.stringify(user.value))
    return res.data
  }

  return { token, user, isLoggedIn, isAdmin, isManager, isBoss, isEvaluator, isChief, isExecutive, hasRole, allowedFeatures, hasFeature, login, logout, fetchMe }
})
