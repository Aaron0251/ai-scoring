<template>
  <AppLayout>
    <div class="scene-list">
      <!-- ── 標題列 ─────────────────────────── -->
      <div class="toolbar">
        <h2 class="page-title">場景管理</h2>
        <div style="display:flex;gap:8px;">
          <el-button
            :disabled="selectedScenes.length === 0"
            @click="exportSelected"
          >匯出選取（{{ selectedScenes.length }}）</el-button>
          <el-button
            v-if="auth.isAdmin || auth.isManager || auth.isChief || auth.isExecutive"
            type="primary"
            @click="openCreateDialog"
          >+ 新增場景</el-button>
        </div>
      </div>

      <!-- ── 篩選列 ─────────────────────────── -->
      <div class="filter-bar">
        <el-select
          v-model="filterDivision"
          placeholder="本部"
          clearable
          style="width:130px"
          @change="onDivisionChange"
        >
          <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>

        <el-select
          v-model="filterDept"
          placeholder="部門"
          clearable
          style="width:140px"
          @change="onDeptChange"
        >
          <el-option v-for="d in filteredDepts" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>

        <el-select
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
      <el-table :data="scenes" stripe size="small" v-loading="loading" style="margin-top:12px" @selection-change="selectedScenes = $event">
        <el-table-column type="selection" width="45" />
        <el-table-column label="本部" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.department?.division?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="種子負責人" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.seedOwners || '-' }}</template>
        </el-table-column>
        <el-table-column prop="sceneName" label="場景名稱" min-width="200" show-overflow-tooltip />
        <el-table-column label="狀態" width="85" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="進度" width="130">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="6" />
          </template>
        </el-table-column>
        <el-table-column label="最後日誌" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.lastLog">
              <span style="color:#909399;margin-right:6px">{{ row.lastLog.logDate?.substring(0,10) }}</span>
              <span>{{ row.lastLog.content }}</span>
            </template>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>

        <el-table-column label="預估節省時數" width="115" align="right">
          <template #default="{ row }">{{ (row.originalHours != null && row.improvedHours != null) ? +(row.originalHours - row.improvedHours).toFixed(1) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div style="display:flex;gap:6px;">
              <el-button size="small" @click="openDetail(row)">查看</el-button>
              <el-button
                v-if="auth.isAdmin || auth.isManager || auth.isChief || auth.isExecutive"
                size="small" type="primary"
                @click="openEdit(row)"
              >編輯</el-button>
              <el-button
                v-if="auth.isAdmin"
                size="small" type="danger"
                @click="handleDelete(row)"
              >刪除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- ── 新增場景 Dialog ────────────────── -->
    <el-dialog v-model="showCreate" title="新增場景" width="560px" :close-on-click-modal="false">
      <el-form :model="createForm" label-width="110px" size="small">
        <el-form-item label="所屬部門" required>
          <el-select v-model="createForm.departmentId" placeholder="選擇部門" style="width:100%" @change="onCreateDeptChange">
            <el-option v-for="d in filteredDepts" :key="d.id" :label="`${d.division?.name} / ${d.name}`" :value="d.id" />
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { scenesApi, divisionsApi, departmentsApi, sectionsApi } from '../api/index.js'
import * as XLSX from 'xlsx'
import { useAuthStore } from '../stores/auth.js'
import AppLayout from '../components/AppLayout.vue'

const auth = useAuthStore()
const router = useRouter()

const scenes = ref([])
const loading = ref(false)
const selectedScenes = ref([])

function exportSelected() {
  const rows = selectedScenes.value.map(s => ({
    // ── Tab1 基本資訊 ──────────────────────────
    '場景編號': s.itemNo || '',
    '場景名稱': s.sceneName || '',
    '是否由資訊協助完成': s.itAssisted === true ? '是' : s.itAssisted === false ? '否' : '',
    // 組織結構
    '本部': s.department?.division?.name || '',
    '部門': s.department?.name || '',
    '課別': s.section?.name || '',
    // 開發資訊
    '維持/開發/作廢': s.maintainOrDevelop || '',
    '開發方式': s.developMethod || '',
    'AI Agent 用途分類': s.agentCategory || '',
    '開發工具說明': s.developToolDesc || '',
    // 責任人員
    '任務負責人': s.taskOwners || '',
    '種子負責人': s.seedOwners || '',
    // ── Tab2 場景內容 ──────────────────────────
    // 需求定義
    '常見問項/希望AI處理什麼': s.inputDesc || '',
    // 任務執行
    '預期輸出成果': s.outputDesc || '',
    '任務步驟或處理邏輯': s.taskSteps || '',
    '原始資料範例說明': s.rawDataExample || '',
    '最終資料範例說明': s.finalDataExample || '',
    // ── Tab3 管理與成效 ────────────────────────
    // 執行數據
    '每次執行耗費時間': s.timePerExecution || '',
    '執行頻率': s.monthlyFrequency || '',
    '有需求的人數': s.demandCount ?? '',
    // 進度與優先序
    '優先序': s.priority || '',
    '狀態': s.status || '',
    '進度(%)': s.progress ?? '',
    '成立日': s.establishDate?.substring(0, 10) || '',
    '預計完成日': s.targetDate?.substring(0, 10) || '',
    '上線日期時間': s.goLiveDate?.substring(0, 10) || '',
    // 成效指標
    '原總作業時數': s.originalHours ?? '',
    '改善後預估總作業時數': s.improvedHours ?? '',
    '預估節省時數': (s.originalHours != null && s.improvedHours != null) ? +(s.originalHours - s.improvedHours).toFixed(1) : '',
    '原總作業人數': s.originalHeadcount ?? '',
    '改善後總作業人數': s.improvedHeadcount ?? '',
    '節省人數': (s.originalHeadcount != null && s.improvedHeadcount != null) ? s.originalHeadcount - s.improvedHeadcount : '',
    '實際節省時數合計(h)': (() => { const all = s.actualSavings || []; const total = all.reduce((sum, row) => sum + [row.jan,row.feb,row.mar,row.apr,row.may,row.jun,row.jul,row.aug,row.sep,row.oct,row.nov,row.dec].reduce((a,v) => a + (v||0), 0), 0); return total || ''; })(),
    '文字成效說明': s.resultText || '',
    '上線實際成效說明': s.actualResultText || '',
    '其他量化成效說明': s.otherMetrics || '',
    '備註': s.note || '',
    // 執行日誌
    '最後日誌日期': s.lastLog?.logDate?.substring(0, 10) || '',
    '最後日誌內容': s.lastLog?.content || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '場景資料')
  XLSX.writeFile(wb, `場景匯出_${new Date().toISOString().substring(0,10)}.xlsx`)
}

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

const filteredDepts = computed(() => {
  // manager / chief 只能看自己本部的部門
  if ((auth.isManager || auth.isChief) && !auth.isAdmin && !auth.isExecutive && auth.user?.divisionId) {
    return allDepts.value.filter(d => d.divisionId === auth.user.divisionId)
  }
  // admin / executive 按 filterDivision 篩選
  return filterDivision.value
    ? allDepts.value.filter(d => d.divisionId === filterDivision.value)
    : allDepts.value
})

const filteredSections = computed(() => {
  // manager / chief 只能看自己本部部門的課別
  if ((auth.isManager || auth.isChief) && !auth.isAdmin && !auth.isExecutive && auth.user?.divisionId) {
    const myDepts = allDepts.value.filter(d => d.divisionId === auth.user.divisionId)
    if (filterDept.value) {
      return allSections.value.filter(s => s.departmentId === filterDept.value)
    }
    return allSections.value.filter(s => myDepts.some(d => d.id === s.departmentId))
  }
  // admin 則按原邏輯
  return filterDept.value
    ? allSections.value.filter(s => s.departmentId === filterDept.value)
    : (filterDivision.value
      ? allSections.value.filter(s => filteredDepts.value.some(d => d.id === s.departmentId))
      : allSections.value)
})

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

  // chief / manager 只能看自己本部的場景（admin / executive 不限制）
  if ((auth.isChief || auth.isManager) && !auth.isAdmin && !auth.isExecutive && auth.user?.divisionId) {
    filterDivision.value = auth.user.divisionId
  }

  await loadScenes()

  // manager / chief 預設帶入自己部門（admin / boss / executive 不受限制）
  if (!auth.isAdmin && !auth.isExecutive && auth.user?.departmentId) {
    createForm.value.departmentId = auth.user.departmentId
    await loadCreateSections(auth.user.departmentId)
  }
})

async function loadScenes() {
  loading.value = true
  try {
    const params = {}
    // admin / boss 可傳 divisionId 篩選，chief 由後端自動過濾
    if (auth.isAdmin && filterDivision.value) params.divisionId = filterDivision.value
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
  // chief / manager 防護：不允許改變本部（admin / executive 不受限制）
  if ((auth.isChief || auth.isManager) && !auth.isAdmin && !auth.isExecutive && auth.user?.divisionId && filterDivision.value !== auth.user.divisionId) {
    filterDivision.value = auth.user.divisionId
    return
  }
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
    departmentId: (!auth.isAdmin && !auth.isExecutive && auth.user?.departmentId) ? auth.user.departmentId : null,
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

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `確定要刪除場景「${row.sceneName}」？此操作無法復原，相關執行日誌與成效記錄也將一併刪除。`,
      '刪除確認',
      { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning', confirmButtonClass: 'el-button--danger' }
    )
  } catch { return }
  try {
    await scenesApi.remove(row.id)
    ElMessage.success('場景已刪除')
    await loadScenes()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '刪除失敗')
  }
}

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
