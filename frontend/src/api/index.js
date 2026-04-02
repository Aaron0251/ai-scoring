import axios from 'axios' 



// 本機開發使用相對路徑（vite proxy），正式部署時從環境變數讀取 Railway URL
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 30000,
})

// 請求攔截：自動帶入 JWT
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 回應攔截：401 自動登出（登入頁本身不處理）
api.interceptors.response.use(
  res => res,
  err => {
    const isLoginRequest = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginRequest) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────
export const authApi = {
  login: (data) => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    return api.post('/auth/login', data)
  },
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
}

// ── 組織架構 ──────────────────────────────────
export const divisionsApi = {
  list: () => api.get('/divisions'),
  create: (data) => api.post('/divisions', data),
  update: (id, data) => api.put(`/divisions/${id}`, data),
  remove: (id) => api.delete(`/divisions/${id}`),
}

export const departmentsApi = {
  list: () => api.get('/departments'),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  remove: (id) => api.delete(`/departments/${id}`),
}

export const sectionsApi = {
  list: (params) => api.get('/sections', { params }),
  create: (data) => api.post('/sections', data),
  update: (id, data) => api.put(`/sections/${id}`, data),
  remove: (id) => api.delete(`/sections/${id}`),
}

// ── 主管名單 ──────────────────────────────────
export const deptPersonsApi = {
  list: (params) => api.get('/dept-persons', { params }),
  create: (data) => api.post('/dept-persons', data),
  update: (id, data) => api.put(`/dept-persons/${id}`, data),
  remove: (id) => api.delete(`/dept-persons/${id}`),
}

// ── 使用者 ────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, data) => api.post(`/users/${id}/reset-password`, data),
  remove: (id) => api.delete(`/users/${id}`),
}

// ── 機關首長 ──────────────────────────────────
export const orgChiefsApi = {
  list: () => api.get('/org-chiefs'),
  create: (data) => api.post('/org-chiefs', data),
  update: (id, data) => api.put(`/org-chiefs/${id}`, data),
  remove: (id) => api.delete(`/org-chiefs/${id}`),
}

// ── AI 場景 ───────────────────────────────────
export const scenesApi = {
  list: (params) => api.get('/scenes', { params }),
  get: (id) => api.get(`/scenes/${id}`),
  create: (data) => api.post('/scenes', data),
  update: (id, data) => api.put(`/scenes/${id}`, data),
  remove: (id) => api.delete(`/scenes/${id}`),
}

// ── 場景執行日誌 ──────────────────────────────
export const executionLogsApi = {
  list:   (sceneId, params) => api.get(`/scenes/${sceneId}/execution-logs`, { params }),
  create: (sceneId, data)   => api.post(`/scenes/${sceneId}/execution-logs`, data),
  update: (sceneId, id, data) => api.put(`/scenes/${sceneId}/execution-logs/${id}`, data),
  remove: (sceneId, id)     => api.delete(`/scenes/${sceneId}/execution-logs/${id}`),
}

export const actualSavingsApi = {
  list:   (sceneId)         => api.get(`/scenes/${sceneId}/actual-savings`),
  upsert: (sceneId, year, data) => api.put(`/scenes/${sceneId}/actual-savings/${year}`, data),
}

// ── Excel 匯入 ────────────────────────────────
export const importApi = {
  uploadExcel: (formData) => api.post('/import/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  downloadTemplate: () => api.get('/import/template', { responseType: 'blob' }),
  exportExcel: () => api.get('/import/export', { responseType: 'blob' }),
}

// ── 系統設定 ──────────────────────────────────
export const configApi = {
  getAll: () => api.get('/config'),
  update: (key, value) => api.put(`/config/${key}`, { value }),
}

// ── Dashboard ─────────────────────────────────
export const dashboardApi = {
  summary: () => api.get('/dashboard'),
  drilldown: (params) => api.get('/dashboard/drilldown', { params }),
  executionTable: () => api.get('/dashboard/execution-table'),
}

// ── 評核週期 & 項目 ───────────────────────────
export const periodsApi = {
  list: () => api.get('/periods'),
  get: (id) => api.get(`/periods/${id}`),
  create: (data) => api.post('/periods', data),
  update: (id, data) => api.put(`/periods/${id}`, data),
  remove: (id) => api.delete(`/periods/${id}`),
}

export const criteriaApi = {
  list: (params) => api.get('/criteria', { params }),
  create: (data) => api.post('/criteria', data),
  update: (id, data) => api.put(`/criteria/${id}`, data),
  remove: (id) => api.delete(`/criteria/${id}`),
}

// ── 评分相关 API 已删除 ──

export const efficiencyReportsApi = {
  get: (params) => api.get('/efficiency-reports', { params }),
}

export const rolePermissionsApi = {
  getAll: () => api.get('/role-permissions'),
  updateBatch: (updates) => api.put('/role-permissions', updates),
}

export default api
