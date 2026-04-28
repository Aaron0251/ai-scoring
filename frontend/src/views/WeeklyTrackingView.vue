<template>
  <AppLayout>
  <div class="weekly-tracking-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <div>
        <h1>各本部週進度追蹤</h1>
        <p>即時掌握各本部每週進度動態，及時發現進度落後</p>
      </div>
      <el-button type="success" @click="exportWeeklyReport">
        匯出週報 Excel
      </el-button>
    </div>

    <!-- 篩選面板 -->
    <el-card class="filter-panel">
      <template #header>
        <div class="card-header">
          <span>🔍 篩選條件</span>
        </div>
      </template>
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>本部</label>
            <el-select
              v-model="filters.division"
              placeholder="選擇本部"
              @change="handleDivisionChange"
              :clearable="!divisionLocked"
              :disabled="divisionLocked"
            >
              <el-option label="全部本部" :value="null" />
              <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>部門</label>
            <el-select v-model="filters.department" placeholder="選擇部門" @change="handleDepartmentChange" clearable :disabled="!filters.division && !isAdmin">
              <el-option label="全部" :value="null" />
              <el-option v-for="d in filteredDepartments" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>課別</label>
            <el-select v-model="filters.section" placeholder="選擇課別" clearable>
              <el-option label="全部" :value="null" />
              <el-option v-for="s in filteredSections" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </div>
        </el-col>
        <el-col :xs="24" :sm="12" :md="6">
          <div class="filter-item">
            <label>週別</label>
            <el-date-picker
              v-model="currentDate"
              type="week"
              placeholder="選擇週"
              @change="handleWeekChange"
              format="YYYY/MM/DD"
            />
          </div>
        </el-col>
      </el-row>
      <el-row :gutter="20" style="margin-top: 12px">
        <el-col :xs="24" :md="12">
          <div class="week-navigator">
            <el-button @click="previousWeek" :icon="ArrowLeft">上週</el-button>
            <el-button @click="currentWeek" type="primary">本週</el-button>
            <el-button @click="nextWeek" :icon="ArrowRight">下週</el-button>
            <span class="week-display">{{ weekDisplay }}</span>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <!-- KPI 卡片 -->
    <div class="kpi-section">
      <el-row :gutter="16" class="kpi-row">
        <el-col :xs="24" :sm="6">
          <el-card class="kpi-card">
            <div class="kpi-label">總場景數</div>
            <div class="kpi-value">{{ data.kpis?.totalScenes || 0 }}</div>
            <div class="kpi-sub">進行中 {{ data.kpis?.totalScenes || 0 }} 個</div>
            <el-progress :percentage="100" :stroke-width="6" class="kpi-progress" :show-text="false" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="6">
          <el-card class="kpi-card orange">
            <div class="kpi-label">115年預估節省時數</div>
            <div class="kpi-value">{{ Math.round(data.kpis?.savingHours || 0).toLocaleString() }} <small>h</small></div>
            <div class="kpi-sub" style="display:flex;justify-content:space-between">
              <span>預估月均 {{ (data.kpis?.estimatedMonthlyAvg || 0).toFixed(0) }} h</span>
              <span>實際月均 {{ (data.kpis?.actualMonthlyAvg || 0).toFixed(0) }} h</span>
            </div>
            <el-progress :percentage="100" :stroke-width="6" status="warning" class="kpi-progress" :show-text="false" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="6">
          <el-card class="kpi-card blue">
            <div class="kpi-label">平均進度</div>
            <div class="kpi-value">{{ data.kpis?.avgProgress || 0 }} <small>%</small></div>
            <div class="kpi-sub">本週追蹤場景 {{ data.weeklyProgressItems?.length || 0 }} 個有更新</div>
            <el-progress :percentage="data.kpis?.avgProgress || 0" :stroke-width="6" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="6">
          <el-card class="kpi-card green">
            <div class="kpi-label">人力釋放率</div>
            <div class="kpi-value">{{ data.kpis?.humanReleaseRate || 0 }} <small>%</small></div>
            <div class="kpi-sub">已上線場景的人力節省</div>
            <el-progress :percentage="data.kpis?.humanReleaseRate || 0" :stroke-width="6" status="success" class="kpi-progress" />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 圖表區域（暫時隱藏：節省時數分析各部門對比 & Top5） -->
    <!-- <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :xs="24" :md="14">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>📊 節省時數分析：各部門對比</span>
            </div>
          </template>
          <div ref="savingChartRef" style="width: 100%; height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>🏆 節省時數最多 Top 5</span>
            </div>
          </template>
          <div class="top-projects">
            <div v-if="topProjects.length === 0" class="empty-state">
              <el-empty description="本週無資料" :image-size="60" />
            </div>
            <div v-for="(item, idx) in topProjects" :key="idx" class="top-project-item">
              <div class="rank-badge" :class="`rank-${idx + 1}`">{{ idx + 1 }}</div>
              <div class="project-info">
                <div class="project-name">{{ item.sceneName }}</div>
                <div class="project-value">節省 {{ item.savings?.toFixed(1) ?? 0 }}h</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row> -->

    <!-- 本週有進度更新的場景 -->
    <el-card style="margin-bottom: 20px">
      <template #header>
        <div class="card-header">
          <span>✅ 本週有進度變動的場景（有在推動的項目）</span>
          <el-tag v-if="data.weeklyProgressItems?.length" type="success">{{ data.weeklyProgressItems.length }} 項</el-tag>
        </div>
      </template>
      <div v-if="!data.weeklyProgressItems?.length" class="empty-state">
        <el-empty description="本週無進度變動紀錄" />
      </div>
      <div v-else class="progress-cards">
        <div v-for="item in data.weeklyProgressItems" :key="item.sceneId" class="progress-card">
          <div class="card-header-row">
            <div class="scene-id">{{ item.itemNo }}</div>
            <el-tag size="small" :type="getPriorityType(item.priority)">{{ item.priority }}</el-tag>
            <el-tag size="small" type="info">{{ item.status }}</el-tag>
          </div>
          <div class="scene-name">【{{ item.sceneName }}】</div>
          <div class="progress-info">
            <el-progress :percentage="item.currentProgress || 0" :color="getProgressColor(item.currentProgress)" />
            <div class="progress-stats">
              <span>前週進度：{{ item.previousProgress || 0 }}%</span>
              <span>本週進度：{{ item.currentProgress || 0 }}%</span>
              <span class="change-indicator" :class="item.changePercent > 0 ? 'positive' : item.changePercent < 0 ? 'negative' : ''">
                {{ item.changePercent > 0 ? '▲' : item.changePercent < 0 ? '▼' : '─' }}
                {{ item.changePercent > 0 ? '+' : '' }}{{ item.changePercent || 0 }}%
              </span>
            </div>
          </div>
          <div v-if="item.lastLog" class="last-log">
            <strong>最新執行紀錄：</strong>
            <div>{{ formatDate(item.lastLog.logDate) }} - {{ item.lastLog.content }}</div>
          </div>
          <div class="department-info">
            <span v-if="item.division">{{ item.division }}</span>
            <span v-if="item.department"> / {{ item.department }}</span>
            <span v-if="item.section"> / {{ item.section }}</span>
          </div>
          <div class="action-buttons">
            <el-button type="primary" size="small" @click="goToSceneDetail(item.sceneId)">查看詳情</el-button>
            <el-button size="small" @click="quickEditProgress(item)">快速更新進度</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 連續無進度的場景（風險警示） -->
    <el-card>
      <template #header>
        <div class="card-header">
          <span>⚠️ 連續 2 週以上無進度變動場景（風險警示）</span>
          <el-tag v-if="data.stagnatedScenes?.length" type="danger">{{ data.stagnatedScenes.length }} 個風險</el-tag>
        </div>
      </template>
      <div v-if="!data.stagnatedScenes?.length" class="empty-state">
        <el-empty description="暫無進度停滯風險場景" />
      </div>
      <div v-else class="stagnated-cards">
        <div v-for="item in data.stagnatedScenes" :key="item.sceneId" class="stagnated-card">
          <div class="risk-header">
            <el-tag type="danger" size="small">⚠️ 風險警示</el-tag>
            <div class="scene-id">{{ item.itemNo }}</div>
            <el-tag size="small" :type="getPriorityType(item.priority)">{{ item.priority }}</el-tag>
            <el-tag size="small" type="info">{{ item.status }}</el-tag>
          </div>
          <div class="scene-name">【{{ item.sceneName }}】</div>
          <div class="risk-info">
            <div class="risk-item">
              <strong>最後更新日期：</strong> {{ item.lastUpdateDate }}
              <el-tag type="warning" size="small" style="margin-left:8px">{{ item.daysWithoutProgress }} 天無進度</el-tag>
            </div>
            <div class="risk-item">
              <strong>已停滯週數：</strong> {{ item.stagnationWeeks }} 週（含本週）
            </div>
            <div v-if="item.daysOverdue" class="risk-item overdue">
              <strong>⏰ 逾期天數：</strong> {{ item.daysOverdue }} 天
            </div>
          </div>
          <div v-if="item.lastLog" class="last-log">
            <strong>最新執行紀錄：</strong>
            <div>{{ formatDate(item.lastLog.logDate) }} - {{ item.lastLog.content }}</div>
          </div>
          <div class="department-info">
            <span v-if="item.division">{{ item.division }}</span>
            <span v-if="item.department"> / {{ item.department }}</span>
            <span v-if="item.section"> / {{ item.section }}</span>
          </div>
          <div class="action-buttons">
            <el-button type="primary" size="small" @click="goToSceneDetail(item.sceneId)">查看詳情</el-button>
            <el-button size="small" @click="quickEditProgress(item)">快速更新進度</el-button>
            <el-button type="success" size="small" @click="markAsCompleted(item.sceneId)">標記完成</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 快速更新進度彈窗 -->
    <el-dialog v-model="editDialogVisible" title="快速更新進度" width="400px">
      <div class="edit-form">
        <div class="form-item">
          <label>場景：{{ currentEditItem?.sceneName }}</label>
        </div>
        <div class="form-item">
          <label>當前進度：{{ currentEditItem?.currentProgress || currentEditItem?.progress }}%</label>
        </div>
        <div class="form-item">
          <label>新進度</label>
          <el-slider v-model="newProgress" :min="0" :max="100" show-stops />
          <div style="text-align:center; font-size:18px; font-weight:bold; color:#409eff">{{ newProgress }}%</div>
        </div>
        <div class="form-item">
          <label>備註（可選）</label>
          <el-input v-model="progressRemarks" placeholder="輸入進度更新備註" type="textarea" :rows="2" />
        </div>
      </div>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitProgressEdit">確認更新</el-button>
      </template>
    </el-dialog>
  </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import AppLayout from '@/components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth.js'
import { divisionsApi, departmentsApi, sectionsApi } from '@/api/index.js'
import api from '@/api/index.js'
import * as echarts from 'echarts'
import * as XLSX from 'xlsx'

const router = useRouter()
const authStore = useAuthStore()

// ── 狀態 ────────────────────────────────────────────────────────
const filters = reactive({
  division: null,
  department: null,
  section: null,
})

const currentDate = ref(new Date())
const data = ref({
  kpis: {},
  weeklyProgressItems: [],
  stagnatedScenes: [],
})

const divisions = ref([])
const departments = ref([])
const sections = ref([])

const editDialogVisible = ref(false)
const currentEditItem = ref(null)
const newProgress = ref(0)
const progressRemarks = ref('')

const savingChartRef = ref(null)

// 是否為無限制角色（admin / boss / executive）
const isAdmin = computed(() => authStore.user?.roles?.includes('admin') ?? false)
// 使用者是否被限定在特定本部
const userDivisionId = computed(() => authStore.user?.divisionId ?? null)
// 本部篩選是否鎖定（有指定本部的角色不可切換）
const divisionLocked = computed(() => !!userDivisionId.value)

// ── 計算屬性 ─────────────────────────────────────────────────────
const weekDisplay = computed(() => {
  const start = getWeekStart(currentDate.value)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${formatDate(start)} ~ ${formatDate(end)}`
})

const filteredDepartments = computed(() => {
  if (!filters.division) return departments.value
  return departments.value.filter(d => d.divisionId === filters.division)
})

const filteredSections = computed(() => {
  if (!filters.department) return sections.value
  return sections.value.filter(s => s.departmentId === filters.department)
})

// Top 5 直接使用後端計算好的（含 savingHoursMonthly，來自全部場景）
const topProjects = computed(() => data.value.topSavings || [])

// ── 方法 ─────────────────────────────────────────────────────────
function formatDate(date) {
  if (!date) return ''
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

function previousWeek() {
  currentDate.value = new Date(currentDate.value.getTime() - 7 * 24 * 60 * 60 * 1000)
  fetchWeeklyTracking()
}

function nextWeek() {
  currentDate.value = new Date(currentDate.value.getTime() + 7 * 24 * 60 * 60 * 1000)
  fetchWeeklyTracking()
}

function currentWeek() {
  currentDate.value = new Date()
  fetchWeeklyTracking()
}

function handleDivisionChange() {
  filters.department = null
  filters.section = null
  fetchWeeklyTracking()
}

function handleDepartmentChange() {
  filters.section = null
  fetchWeeklyTracking()
}

function handleWeekChange() {
  fetchWeeklyTracking()
}

async function fetchWeeklyTracking() {
  try {
    const weekStart = getWeekStart(currentDate.value)
    const params = { week: formatDate(weekStart) }
    if (filters.division) params.division = filters.division
    if (filters.department) params.department = filters.department
    if (filters.section) params.section = filters.section

    const res = await api.get('/weekly-tracking', { params })
    data.value = res.data

    nextTick(() => {
      drawSavingChart()
    })
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '取得資料失敗')
  }
}

function drawSavingChart() {
  if (!savingChartRef.value) return

  const existingChart = echarts.getInstanceByDom(savingChartRef.value)
  if (existingChart) existingChart.dispose()

  const chart = echarts.init(savingChartRef.value)

  const departmentData = {}
  ;(data.value.weeklyProgressItems || []).forEach(item => {
    const dept = item.department || '未分類'
    if (!departmentData[dept]) {
      departmentData[dept] = { original: 0, improved: 0 }
    }
    departmentData[dept].original += item.originalHours || 0
    departmentData[dept].improved += item.improvedHours || 0
  })

  const deptNames = Object.keys(departmentData)
  const originalData = deptNames.map(d => departmentData[d].original)
  const improvedData = deptNames.map(d => departmentData[d].improved)

  if (deptNames.length === 0) {
    chart.setOption({
      title: { text: '本週暫無資料', left: 'center', top: 'middle', textStyle: { color: '#999' } },
    })
    return
  }

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['原作業時數', '改善後時數'] },
    xAxis: { type: 'category', data: deptNames, axisLabel: { rotate: 30 } },
    yAxis: { type: 'value', name: '時數' },
    series: [
      { name: '原作業時數', data: originalData, type: 'bar', color: '#FF6B6B' },
      { name: '改善後時數', data: improvedData, type: 'bar', color: '#4ECDC4' },
    ],
  })

  window.addEventListener('resize', () => chart.resize())
}

function getProgressColor(progress) {
  if (progress >= 80) return '#67C23A'
  if (progress >= 50) return '#E6A23C'
  if (progress >= 20) return '#F56C6C'
  return '#909399'
}

function getPriorityType(priority) {
  if (priority === '高') return 'danger'
  if (priority === '中') return 'warning'
  return 'info'
}

function goToSceneDetail(sceneId) {
  router.push(`/scenes/${sceneId}`)
}

function quickEditProgress(item) {
  currentEditItem.value = item
  newProgress.value = item.currentProgress || item.progress || 0
  progressRemarks.value = ''
  editDialogVisible.value = true
}

async function submitProgressEdit() {
  try {
    await api.post('/weekly-tracking/update-progress', {
      sceneId: currentEditItem.value.sceneId,
      newProgress: newProgress.value,
      remarks: progressRemarks.value,
    })
    ElMessage.success('進度更新成功')
    editDialogVisible.value = false
    fetchWeeklyTracking()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '更新失敗')
  }
}

async function markAsCompleted(sceneId) {
  try {
    await ElMessageBox.confirm('確定要標記此場景為完成嗎？', '確認', {
      confirmButtonText: '確認',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await api.put(`/scenes/${sceneId}`, { progress: 100, status: '已完成' })
    ElMessage.success('場景已標記為完成')
    fetchWeeklyTracking()
  } catch (err) {
    if (err !== 'cancel' && err?.message !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '操作失敗')
    }
  }
}

function exportWeeklyReport() {
  const wb = XLSX.utils.book_new()
  const weekLabel = data.value.week || weekDisplay.value

  // ── Sheet 1：KPI 摘要 ──
  const kpis = data.value.kpis || {}
  const kpiRows = [
    ['週別', weekLabel],
    ['總場景數', kpis.totalScenes ?? '-'],
    ['預估節省時數(月)', kpis.savingHours ?? '-'],
    ['平均進度(%)', kpis.avgProgress ?? '-'],
    ['人力釋放率(%)', kpis.humanReleaseRate ?? '-'],
  ]
  const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows)
  wsKpi['!cols'] = [{ wch: 20 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsKpi, 'KPI 摘要')

  // ── Sheet 2：本週有進度變動的場景 ──
  const progressHeader = ['場景編號', '場景名稱', '本部', '部門', '課別', '優先序', '狀態', '上週進度(%)', '本週進度(%)', '變動(%)']
  const progressRows = (data.value.weeklyProgressItems || []).map(item => [
    item.itemNo, item.sceneName, item.division || '', item.department || '', item.section || '',
    item.priority, item.status, item.previousProgress ?? 0, item.currentProgress ?? 0, item.changePercent ?? 0,
  ])
  const wsProgress = XLSX.utils.aoa_to_sheet([progressHeader, ...progressRows])
  wsProgress['!cols'] = progressHeader.map((_, i) => ({ wch: i <= 1 ? 30 : 14 }))
  XLSX.utils.book_append_sheet(wb, wsProgress, '本週進度變動')

  // ── Sheet 3：停滯場景風險清單 ──
  const stagnatedHeader = ['場景編號', '場景名稱', '本部', '部門', '優先序', '狀態', '目前進度(%)', '最後更新日期', '停滯天數', '停滯週數', '逾期天數']
  const stagnatedRows = (data.value.stagnatedScenes || []).map(item => [
    item.itemNo, item.sceneName, item.division || '', item.department || '',
    item.priority, item.status, item.currentProgress ?? 0,
    item.lastUpdateDate || '', item.daysWithoutProgress ?? 0, item.stagnationWeeks ?? 0, item.daysOverdue ?? '',
  ])
  const wsStagnated = XLSX.utils.aoa_to_sheet([stagnatedHeader, ...stagnatedRows])
  wsStagnated['!cols'] = stagnatedHeader.map((_, i) => ({ wch: i <= 1 ? 30 : 14 }))
  XLSX.utils.book_append_sheet(wb, wsStagnated, '停滯風險清單')

  const filename = `週進度報告_${weekLabel?.replace(/\s*~\s*/g, '_') || formatDate(new Date())}.xlsx`
  XLSX.writeFile(wb, filename)
  ElMessage.success('週報已匯出')
}

async function loadOrganization() {
  try {
    const [divRes, deptRes, secRes] = await Promise.all([
      divisionsApi.list(),
      departmentsApi.list(),
      sectionsApi.list(),
    ])
    divisions.value = divRes.data || []
    departments.value = deptRes.data || []
    sections.value = secRes.data || []
  } catch (err) {
    console.error('載入組織架構失敗', err)
  }
}

// ── 生命週期 ─────────────────────────────────────────────────────
onMounted(async () => {
  await loadOrganization()
  // 若使用者有限定本部，預帶篩選條件
  if (userDivisionId.value) {
    filters.division = userDivisionId.value
  }
  fetchWeeklyTracking()
})
</script>

<style scoped>
.weekly-tracking-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100%;
}

.page-header {
  margin-bottom: 20px;
  padding: 20px 0;
  border-bottom: 2px solid #409eff;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header h1 {
  font-size: 26px;
  font-weight: bold;
  color: #333;
  margin: 0;
}

.page-header p {
  color: #666;
  margin: 8px 0 0 0;
}

.filter-panel {
  margin-bottom: 20px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.filter-item label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.filter-item :deep(.el-select),
.filter-item :deep(.el-date-editor) {
  width: 100%;
}

.week-navigator {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.week-display {
  padding: 8px 14px;
  background: #f0f9ff;
  border-radius: 4px;
  font-weight: 500;
  color: #409eff;
  border: 1px solid #b3d8ff;
  font-size: 14px;
}

/* KPI 卡片 */
.kpi-section {
  margin-bottom: 20px;
}

.kpi-row { margin-bottom: 16px; }
.kpi-card { text-align: center; margin-bottom: 12px; }
.kpi-card.green :deep(.el-card__body) { background: #f0f9eb; }
.kpi-card.blue  :deep(.el-card__body) { background: #ecf5ff; }
.kpi-card.orange :deep(.el-card__body) { background: #fdf6ec; }
.kpi-label { font-size: 13px; color: #909399; margin-bottom: 8px; }
.kpi-value { font-size: 36px; font-weight: 700; color: #303133; line-height: 1; }
.kpi-value small { font-size: 16px; font-weight: 400; color: #606266; }
.kpi-sub { font-size: 12px; color: #909399; margin: 6px 0 8px; }
.kpi-progress { margin-top: 4px; }

/* 卡片標題 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

/* Top 5 */
.top-projects {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-project-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
}

.rank-badge {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  font-size: 13px;
  background: #e0e0e0;
  color: #666;
  flex-shrink: 0;
}

.rank-1 { background: #FFD700; color: #333; }
.rank-2 { background: #C0C0C0; color: #333; }
.rank-3 { background: #CD7F32; color: #fff; }

.project-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.project-value {
  font-size: 12px;
  color: #4ECDC4;
  font-weight: 600;
}

/* 進度卡片 */
.progress-cards,
.stagnated-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.progress-card,
.stagnated-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
  transition: box-shadow 0.2s;
}

.progress-card:hover,
.stagnated-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.stagnated-card {
  border-left: 4px solid #F56C6C;
  background: #fff9f9;
}

.card-header-row,
.risk-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.scene-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.scene-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
  line-height: 1.4;
}

.progress-info {
  margin-bottom: 10px;
}

.progress-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
  margin-top: 6px;
  flex-wrap: wrap;
}

.change-indicator {
  font-weight: 600;
}

.change-indicator.positive { color: #67C23A; }
.change-indicator.negative { color: #F56C6C; }

.risk-info {
  margin-bottom: 10px;
}

.risk-item {
  font-size: 13px;
  color: #555;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.risk-item.overdue {
  color: #F56C6C;
  font-weight: 600;
}

.last-log {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #555;
  border-left: 3px solid #409eff;
}

.department-info {
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 編輯彈窗 */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.empty-state {
  padding: 20px 0;
  text-align: center;
}
</style>
