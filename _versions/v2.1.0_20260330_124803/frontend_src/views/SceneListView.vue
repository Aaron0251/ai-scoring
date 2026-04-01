<template>
  <AppLayout>
    <div class="scene-list">
      <!-- ── 標題列 ─────────────────────────── -->
      <div class="toolbar">
        <h2 class="page-title">場景管理</h2>
        <el-button
          v-if="auth.isAdmin || auth.isManager"
          type="primary"
          @click="openCreateDialog"
        >+ 新增場景</el-button>
      </div>

      <!-- ── 篩選列 ─────────────────────────── -->
      <div class="filter-bar">
        <el-select
          v-if="auth.isAdmin"
          v-model="filterDivision"
          placeholder="本部"
          clearable
          style="width:130px"
          @change="onDivisionChange"
        >
          <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>

        <el-select
          v-if="auth.isAdmin"
          v-model="filterDept"
          placeholder="部門"
          clearable
          style="width:140px"
          @change="onDeptChange"
        >
          <el-option v-for="d in filteredDepts" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>

        <el-select
          v-if="auth.isAdmin"
          v-model="filterSection"
          placeholder="課別"
          clearable
          style="width:130px"
          @change="loadScenes"
        >
          <el-option v-for="s in filteredSections" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>

        <el-select v-model="filterStatus" placeholder="狀態" clearable style="width:120px" @change="loadScenes">
          <el-option label="規劃中" value="規劃中" />
          <el-option label="進行中" value="進行中" />
          <el-option label="已完成" value="已完成" />
          <el-option label="暫停" value="暫停" />
        </el-select>

        <el-select v-model="filterPriority" placeholder="優先序" clearable style="width:110px" @change="loadScenes">
          <el-option label="高" value="高" />
          <el-option label="中" value="中" />
          <el-option label="低" value="低" />
        </el-select>

        <el-input
          v-model="keyword"
          placeholder="搜尋場景名稱"
          prefix-icon="Search"
          clearable
          style="width:220px"
          @clear="loadScenes"
          @keyup.enter="loadScenes"
        />
        <el-button @click="loadScenes">搜尋</el-button>
      </div>

      <!-- ── 表格 ──────────────────────────── -->
      <el-table :data="scenes" stripe size="small" v-loading="loading" style="margin-top:12px">
        <el-table-column prop="itemNo" label="編號" width="95" />
        <el-table-column prop="sceneName" label="場景名稱" min-width="200" show-overflow-tooltip />
        <el-table-column label="本部" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.department?.division?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="部門" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.department?.name }}</template>
        </el-table-column>
        <el-table-column label="課別" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.section?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="類型" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.maintainOrDevelop" size="small"
              :type="row.maintainOrDevelop === '開發' ? 'success' : row.maintainOrDevelop === '作廢' ? 'danger' : 'info'">
              {{ row.maintainOrDevelop }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="狀態" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="優先序" width="75" align="center">
          <template #default="{ row }">
            <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="進度" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="6" />
          </template>
        </el-table-column>
        <el-table-column label="輬導主管" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.directSupervisor || '-' }}</template>
        </el-table-column>
        <el-table-column label="預估省時(h/月)" width="115" align="right">
          <template #default="{ row }">{{ row.timeSavedHours ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">查看</el-button>
            <el-button
              v-if="auth.isAdmin || auth.isManager"
              size="small" type="primary"
              @click="openEdit(row)"
            >編輯</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ── 新增場景 Dialog ────────────────── -->
    <el-dialog v-model="showCreate" title="新增場景" width="560px" :close-on-click-modal="false">
      <el-form :model="createForm" label-width="110px" size="small">
        <el-form-item label="所屬部門" required>
          <el-select v-model="createForm.departmentId" placeholder="選擇部門" style="width:100%" @change="onCreateDeptChange">
            <el-option v-for="d in allDepts" :key="d.id" :label="`${d.division?.name} / ${d.name}`" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所屬課別">
          <el-select v-model="createForm.sectionId" placeholder="（選填）" clearable style="width:100%">
            <el-option v-for="s in createSections" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="場景名稱" required>
          <el-input v-model="createForm.sceneName" maxlength="100" show-word-limit placeholder="最多 100 字" />
        </el-form-item>
        <el-form-item label="維持/開發/作廢">
          <el-select v-model="createForm.maintainOrDevelop" clearable style="width:100%">
            <el-option label="維持" value="維持" />
            <el-option label="開發" value="開發" />
            <el-option label="作廢" value="作廢" />
          </el-select>
        </el-form-item>
        <el-form-item label="優先序">
          <el-select v-model="createForm.priority" style="width:100%">
            <el-option label="高" value="高" />
            <el-option label="中" value="中" />
            <el-option label="低" value="低" />
          </el-select>
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="createForm.status" style="width:100%">
            <el-option label="規劃中" value="規劃中" />
            <el-option label="進行中" value="進行中" />
            <el-option label="已完成" value="已完成" />
            <el-option label="暫停" value="暫停" />
          </el-select>
        </el-form-item>
        <el-form-item label="任務負責人">
          <el-input v-model="createForm.taskOwners" placeholder="多人以逗號分隔，例：王小明, 李大華" />
        </el-form-item>
        <el-form-item label="種子負責人">
          <el-input v-model="createForm.seedOwners" placeholder="多人以逗號分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">建立並開啟詳情</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { scenesApi, divisionsApi, departmentsApi, sectionsApi } from '../api/index.js'
import { useAuthStore } from '../stores/auth.js'
import AppLayout from '../components/AppLayout.vue'

const auth = useAuthStore()
const router = useRouter()

const scenes = ref([])
const loading = ref(false)

// 篩選
const filterDivision = ref(null)
const filterDept = ref(null)
const filterSection = ref(null)
const filterStatus = ref('')
const filterPriority = ref('')
const keyword = ref('')

// 組織資料
const divisions = ref([])
const allDepts = ref([])
const allSections = ref([])

const filteredDepts = computed(() =>
  filterDivision.value
    ? allDepts.value.filter(d => d.divisionId === filterDivision.value)
    : allDepts.value
)

const filteredSections = computed(() =>
  filterDept.value
    ? allSections.value.filter(s => s.departmentId === filterDept.value)
    : (filterDivision.value
      ? allSections.value.filter(s => filteredDepts.value.some(d => d.id === s.departmentId))
      : allSections.value)
)

// 新增場景
const showCreate = ref(false)
const creating = ref(false)
const createSections = ref([])
const createForm = ref({
  departmentId: null,
  sectionId: null,
  sceneName: '',
  maintainOrDevelop: null,
  priority: '中',
  status: '規劃中',
  taskOwners: '',
  seedOwners: '',
})

onMounted(async () => {
  const [divRes, deptRes, secRes] = await Promise.all([
    divisionsApi.list(),
    departmentsApi.list(),
    sectionsApi.list(),
  ])
  divisions.value = divRes.data
  allDepts.value = deptRes.data
  allSections.value = secRes.data
  await loadScenes()

  // manager 預設帶入自己部門
  if (!auth.isAdmin && auth.user?.departmentId) {
    createForm.value.departmentId = auth.user.departmentId
    await loadCreateSections(auth.user.departmentId)
  }
})

async function loadScenes() {
  loading.value = true
  try {
    const params = {}
    if (filterDivision.value) params.divisionId = filterDivision.value
    if (filterDept.value) params.departmentId = filterDept.value
    if (filterSection.value) params.sectionId = filterSection.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterPriority.value) params.priority = filterPriority.value
    if (keyword.value) params.keyword = keyword.value
    const res = await scenesApi.list(params)
    scenes.value = res.data
  } finally {
    loading.value = false
  }
}

function onDivisionChange() {
  filterDept.value = null
  filterSection.value = null
  loadScenes()
}

function onDeptChange() {
  filterSection.value = null
  loadScenes()
}

async function loadCreateSections(deptId) {
  if (!deptId) { createSections.value = []; return }
  const r = await sectionsApi.list({ departmentId: deptId })
  createSections.value = r.data
}

function onCreateDeptChange(val) {
  createForm.value.sectionId = null
  loadCreateSections(val)
}

function openCreateDialog() {
  createForm.value = {
    departmentId: (!auth.isAdmin && auth.user?.departmentId) ? auth.user.departmentId : null,
    sectionId: null,
    sceneName: '',
    maintainOrDevelop: null,
    priority: '中',
    status: '規劃中',
    taskOwners: '',
    seedOwners: '',
  }
  showCreate.value = true
}

async function handleCreate() {
  if (!createForm.value.departmentId) { ElMessage.warning('請選擇所屬部門'); return }
  if (!createForm.value.sceneName?.trim()) { ElMessage.warning('場景名稱為必填'); return }
  creating.value = true
  try {
    const res = await scenesApi.create(createForm.value)
    showCreate.value = false
    ElMessage.success('已建立，正在開啟詳情頁面...')
    router.push(`/scenes/${res.data.id}?edit=1`)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '建立失敗')
  } finally {
    creating.value = false
  }
}

function openDetail(row) { router.push(`/scenes/${row.id}`) }
function openEdit(row) { router.push(`/scenes/${row.id}?edit=1`) }

function statusType(s) {
  return { '已完成': 'success', '進行中': 'primary', '暫停': 'warning', '規劃中': 'info' }[s] || ''
}
function priorityType(p) {
  return { '高': 'danger', '中': 'warning', '低': 'info' }[p] || ''
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.page-title { margin: 0; font-size: 20px; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
