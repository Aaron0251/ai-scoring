<template>
  <AppLayout>
    <div class="role-permissions">
      <div class="page-header">
        <h2 class="page-title">
          <el-icon><Lock /></el-icon>
          角色功能設定
        </h2>
        <div class="page-subtitle">設定各角色可存取的功能，儲存後下次登入即生效</div>
      </div>

      <div v-if="loading" class="loading-wrapper">
        <el-skeleton :rows="6" animated />
      </div>

      <el-alert v-else-if="error" :title="error" type="error" show-icon :closable="false" />

      <template v-else>
        <!-- 角色說明 -->
        <div class="role-legend">
          <div v-for="role in roles" :key="role" class="legend-item">
            <el-tag :type="roleTagType(role)" size="small">{{ roleLabel(role) }}</el-tag>
          </div>
        </div>

        <!-- 功能權限矩陣表格 -->
        <div class="matrix-wrapper">
          <el-table
            :data="featureRows"
            border
            stripe
            size="small"
            row-key="key"
          >
            <!-- 功能名稱欄 -->
            <el-table-column label="功能" min-width="180" fixed="left">
              <template #default="{ row }">
                <div class="feature-cell">
                  <el-tag v-if="row.isCategory" type="info" size="small" class="category-tag">
                    {{ row.label }}
                  </el-tag>
                  <span v-else class="feature-label">{{ row.label }}</span>
                </div>
              </template>
            </el-table-column>

            <!-- 各角色欄 -->
            <el-table-column
              v-for="role in roles"
              :key="role"
              :label="roleLabel(role)"
              align="center"
              min-width="100"
            >
              <template #default="{ row }">
                <!-- 分類行不顯示 checkbox -->
                <div v-if="row.isCategory" />
                <!-- admin 的 admin 功能強制鎖定 -->
                <el-switch
                  v-else-if="role === 'admin' && adminLockedFeatures.includes(row.key)"
                  :model-value="true"
                  disabled
                  size="small"
                />
                <el-switch
                  v-else
                  v-model="localPermissions[role][row.key]"
                  size="small"
                  :active-color="switchColor(role)"
                  @change="markDirty(role, row.key)"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 儲存按鈕 -->
        <div class="save-bar">
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!isDirty"
            size="large"
            @click="savePermissions"
          >
            <el-icon><Check /></el-icon>
            儲存設定
          </el-button>
          <el-button size="large" :disabled="!isDirty" @click="resetChanges">
            <el-icon><RefreshLeft /></el-icon>
            取消變更
          </el-button>
          <span v-if="isDirty" class="dirty-hint">有未儲存的變更</span>
        </div>

        <!-- 說明區塊 -->
        <el-alert type="info" :closable="false" style="margin-top: 20px">
          <template #title>
            <strong>說明</strong>
          </template>
          <ul class="tips-list">
            <li>儲存後，使用者需要<strong>重新登入</strong>才會套用新的功能權限</li>
            <li>系統管理員（admin）的核心管理功能不可關閉，以防止鎖死系統</li>
            <li>新功能上線後會自動出現在此列表，依預設角色初始化</li>
          </ul>
        </el-alert>
      </template>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppLayout from '../../components/AppLayout.vue'
import api from '../../api/index.js'
import { ROLE_MAP } from '../../constants/roles.js'
import { getFeaturesByCategory } from '../../constants/features.js'
import { Lock, Check, RefreshLeft } from '@element-plus/icons-vue'
import { useAuthStore } from '../../stores/auth.js'

const auth = useAuthStore()

const loading = ref(true)
const saving  = ref(false)
const error   = ref('')
const isDirty = ref(false)

const roles          = ref([])
const allFeatures    = ref([])
const localPermissions = reactive({}) // { role: { featureKey: bool } }
const originalPermissions = ref({})   // 用於取消還原
const dirtySet = reactive(new Set())  // 記錄有哪些 (role,key) 被改過

// admin 不可關閉的功能（防止鎖死）
const adminLockedFeatures = ['admin-users', 'admin-role-permissions']

// 將 features 轉為含分類行的 table rows
const featureRows = computed(() => {
  const rows = []
  const groups = getFeaturesByCategory()
  for (const [category, features] of Object.entries(groups)) {
    rows.push({ key: `__cat__${category}`, label: category, isCategory: true })
    for (const f of features) {
      rows.push({ key: f.key, label: f.label, isCategory: false })
    }
  }
  return rows
})

function roleLabel(role) {
  return ROLE_MAP[role] || role
}

function roleTagType(role) {
  const map = { admin: 'danger', manager: 'primary', chief: 'warning', executive: 'success' }
  return map[role] || 'info'
}

function switchColor(role) {
  const map = { admin: '#f56c6c', manager: '#409eff', chief: '#e6a23c', executive: '#67c23a' }
  return map[role] || '#409eff'
}

function markDirty(role, featureKey) {
  dirtySet.add(`${role}:${featureKey}`)
  isDirty.value = true
}

function resetChanges() {
  const orig = originalPermissions.value
  for (const role of roles.value) {
    for (const key of Object.keys(localPermissions[role] || {})) {
      localPermissions[role][key] = orig[role]?.[key] ?? false
    }
  }
  dirtySet.clear()
  isDirty.value = false
}

async function savePermissions() {
  try {
    saving.value = true

    const updates = []
    for (const role of roles.value) {
      for (const feature of allFeatures.value) {
        const key = feature.key
        // admin 鎖定功能強制 true
        if (role === 'admin' && adminLockedFeatures.includes(key)) continue
        updates.push({ role, featureKey: key, allowed: localPermissions[role][key] })
      }
    }

    await api.put('/role-permissions', updates)
    ElMessage.success('角色功能設定已儲存')

    // 即時刷新當前登入者的 allowedFeatures
    await auth.fetchMe().catch(() => {})

    // 同步 original
    originalPermissions.value = JSON.parse(JSON.stringify(localPermissions))
    dirtySet.clear()
    isDirty.value = false
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '儲存失敗，請重試')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/role-permissions')
    roles.value = data.roles
    allFeatures.value = data.features

    // 初始化 localPermissions
    for (const role of data.roles) {
      localPermissions[role] = {}
      for (const feature of data.features) {
        localPermissions[role][feature.key] = data.permissions[role]?.[feature.key] ?? false
      }
    }
    originalPermissions.value = JSON.parse(JSON.stringify(localPermissions))
  } catch (e) {
    error.value = e.response?.data?.error || '載入失敗，請重試'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.role-permissions {
  max-width: 1100px;
  margin: 0 auto;
  padding-bottom: 40px;
}

.page-header {
  margin-bottom: 20px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.4rem;
  font-weight: 700;
  color: #303133;
  margin: 0 0 4px;
}
.page-subtitle {
  font-size: 0.875rem;
  color: #909399;
}

.role-legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.matrix-wrapper {
  margin-bottom: 20px;
  overflow-x: auto;
}

.feature-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.category-tag {
  font-weight: 700;
}
.feature-label {
  font-size: 0.88rem;
  color: #303133;
  padding-left: 8px;
}

.save-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid #f0f0f0;
}
.dirty-hint {
  font-size: 0.82rem;
  color: #e6a23c;
}

.tips-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 0.85rem;
  line-height: 1.8;
  color: #606266;
}

.loading-wrapper {
  padding: 20px 0;
}

/* 手機響應式 */
@media (max-width: 768px) {
  .matrix-wrapper {
    font-size: 0.8rem;
  }
}
</style>
