<template>
  <AppLayout>
    <div class="dashboard" v-loading="loading">
      <div class="dashboard-header">
        <h2 class="page-title">AI 推動評分 Dashboard</h2>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <!-- admin / executive / chief 可切換本部 -->
          <template v-if="canSwitchDivision">
            <el-select v-model="selectedDivisionId" placeholder="全部本部" clearable style="width:160px" size="small" @change="load">
              <el-option v-for="d in allDivisions" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </template>
          <el-button @click="load" :loading="loading" size="small" plain>
            <el-icon><Refresh /></el-icon> 重新整理
          </el-button>
        </div>
      </div>

      <!-- ① 核心 KPI 總覽 -->
      <div class="section-title-row">
        <div class="section-title">核心 KPI 總覽</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;color:#606266;white-space:nowrap">開發方式</span>
          <el-select
            v-model="selectedMethods"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="全選"
            clearable
            style="width:200px"
            size="small"
            @change="load"
          >
            <el-option v-for="m in methodOptions" :key="m" :label="m" :value="m" />
          </el-select>
        </div>
      </div>
      <el-row :gutter="12" class="kpi-row">
        <el-col :xs="24" :sm="4">
          <el-card class="kpi-card">
            <div class="kpi-label">專案總數</div>
            <div class="kpi-value">{{ kpi.totalScenes ?? '-' }}</div>
            <div class="kpi-sub">上線 {{ kpi.effectiveCount }} / 目標 {{ kpi.targetScenes }}</div>
            <el-progress :percentage="pctScenes" :stroke-width="6" :color="pctScenes >= 100 ? '#67c23a' : ''" :show-text="pctScenes < 100" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="5">
          <el-card class="kpi-card orange">
            <div class="kpi-label">115年預估節省時數</div>
            <div class="kpi-value">{{ Math.round(kpi.annualizedSaved115||0).toLocaleString() }} <small>h</small></div>
            <div class="kpi-sub">預估月均 {{ (kpi.estimatedTimeSaved||0).toFixed(0) }} h</div>
            <el-progress :percentage="100" :stroke-width="6" color="#67c23a" :show-text="false" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="5">
          <el-card class="kpi-card yellow">
            <div class="kpi-label">115年實際節省時數</div>
            <div class="kpi-value">{{ Math.round(kpi.actualSaved115||0).toLocaleString() }} <small>h</small></div>
            <div class="kpi-sub">實際月均 {{ (kpi.actualMonthlyAvg||0).toFixed(0) }} h</div>
            <el-progress :percentage="pctActual" :stroke-width="6" :color="pctActual >= 100 ? '#67c23a' : ''" :show-text="pctActual < 100" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="5">
          <el-card class="kpi-card blue">
            <div class="kpi-label">平均進度</div>
            <div class="kpi-value">{{ avgProgress }} <small>%</small></div>
            <div class="kpi-sub">進行中 {{ kpi.inProgressScenes }}　規劃中 {{ kpi.plannedScenes }}</div>
            <el-progress :percentage="avgProgress" :stroke-width="6" :color="avgProgress >= 100 ? '#67c23a' : ''" :show-text="avgProgress < 100" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="5">
          <el-card class="kpi-card green">
            <div class="kpi-label">人力釋放率</div>
            <div class="kpi-value">{{ headcountReleaseRate }} <small>%</small></div>
            <div class="kpi-sub">節省人數 {{ Number(kpi.headcountSaved||0).toFixed(1) }} 人</div>
            <el-progress :percentage="headcountReleaseRate" :stroke-width="6" :color="headcountReleaseRate >= 100 ? '#67c23a' : ''" :show-text="headcountReleaseRate < 100" class="kpi-progress" />
          </el-card>
        </el-col>
      </el-row>

      <!-- ② 成效分析 -->
      <div class="section-title">成效分析：省時與效率</div>
      <el-row :gutter="16" style="margin-bottom:16px">
        <!-- 省時對比圖 -->
        <el-col :xs="24" :sm="16">
          <el-card>
            <template #header><span>省時對比圖（原作業 vs 改善後預估）</span></template>
            <v-chart :option="barChartOption" class="chart-bar" autoresize />
          </el-card>
        </el-col>
        <!-- Top 5 高價值排行 -->
        <el-col :xs="24" :sm="8">
          <el-card>
            <template #header><span>🏆 高價值專案排行 Top 5</span></template>
            <div v-for="(s,i) in top5" :key="s.id" class="top5-item">
              <div class="top5-rank" :class="`rank-${i+1}`">{{ i+1 }}</div>
              <div class="top5-info">
                <div class="top5-name">{{ s.name }}</div>
                <div class="top5-meta">
                  <el-tag size="small" :type="priorityType(s.priority)">{{ s.priority }}</el-tag>
                  <el-tag size="small" :type="statusType(s.status)" style="margin-left:4px">{{ s.status }}</el-tag>
                </div>
              </div>
              <div class="top5-value">{{ s.savedHours.toFixed(0) }}<small>h</small></div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ③ 各部門執行狀況 -->
      <div class="section-title">各部門執行狀況</div>
      <el-row :gutter="16" style="margin-bottom:16px">
        <!-- 本部專案分佈甜甜圈 -->
        <el-col :xs="24" :sm="8">
          <el-card>
            <template #header><span>本部專案分佈</span></template>
            <v-chart :option="divisionPieOption" class="chart-pie" autoresize />
          </el-card>
        </el-col>
        <!-- 部門執行狀況表格 -->
        <el-col :xs="24" :sm="16">
          <el-card>
            <template #header><span>各本部執行狀況</span></template>
            <!-- 手機版：卡片式列表 -->
            <div class="division-cards">
              <div v-for="row in filteredDivisions" :key="row.name" class="division-card-item">
                <div class="division-card-header">
                  <span class="division-name">{{ row.name }}</span>
                  <span class="division-total">共 {{ row.total }} 個</span>
                </div>
                <div class="division-tags">
                  <el-tag type="success" size="small">完成 {{ row.completed }}</el-tag>
                  <el-tag type="primary" size="small">進行中 {{ row.inProgress }}</el-tag>
                  <el-tag type="info" size="small">規劃中 {{ row.planned }}</el-tag>
                </div>
                <div class="division-progress-row">
                  <span class="division-progress-label">平均進度</span>
                  <el-progress :percentage="row.avgProgress" :stroke-width="6" style="flex:1" />
                </div>
                <div class="division-stats">
                  <span>115年省時 <b>{{ Math.round(row.estimatedSaved||0) }}</b>h</span>
                  <span>實際省時 <b>{{ row.actualSavingsTotal.toFixed(0) }}</b>h</span>
                  <span>省人數 <b>{{ Number(row.headcountSaved||0).toFixed(1) }}</b></span>
                </div>
              </div>
            </div>
            <!-- 桌機版：表格 -->
            <el-table :data="filteredDivisions" size="small" stripe style="width:100%" class="division-table">
              <el-table-column prop="name" label="本部" min-width="120" />
              <el-table-column prop="total" label="總數" width="60" align="center" />
              <el-table-column label="完成" width="60" align="center">
                <template #default="{row}">
                  <el-tag type="success" size="small">{{ row.completed }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="進行中" width="70" align="center">
                <template #default="{row}">
                  <el-tag type="primary" size="small">{{ row.inProgress }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="規劃中" width="70" align="center">
                <template #default="{row}">
                  <el-tag type="info" size="small">{{ row.planned }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="平均進度" width="140">
                <template #default="{row}">
                  <el-progress :percentage="row.avgProgress" :stroke-width="8" />
                </template>
              </el-table-column>
              <el-table-column label="115年預估節省(h)" align="right" min-width="110">
                <template #default="{row}">{{ Math.round(row.estimatedSaved||0).toLocaleString() }}</template>
              </el-table-column>
              <el-table-column label="實際節省(h)" align="right" min-width="100">
                <template #default="{row}">{{ row.actualSavingsTotal.toFixed(0) }}</template>
              </el-table-column>
              <el-table-column label="節省人數" align="right" width="80">
                <template #default="{row}">{{ Number(row.headcountSaved||0).toFixed(1) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- ④ 進度與時程監控 -->
      <div class="section-title">進度與時程監控</div>
      <el-row :gutter="16">
        <!-- 開發方式圓餅圖 -->
        <el-col :xs="24" :sm="8">
          <el-card>
            <template #header><span>開發方式分佈</span></template>
            <v-chart :option="methodPieOption" class="chart-pie" autoresize />
          </el-card>
        </el-col>
        <!-- 異常預警清單 -->
        <el-col :xs="24" :sm="16">
          <el-card>
            <template #header>
              <span>⚠️ 異常預警清單</span>
              <el-tag type="danger" size="small" style="margin-left:8px">{{ alertList.length }}</el-tag>
            </template>
            <!-- 手機版：卡片式 -->
            <div class="alert-cards">
              <div v-for="row in alertList" :key="row.id" class="alert-card-item">
                <div class="alert-card-header">
                  <span class="alert-itemno">{{ row.itemNo }}</span>
                  <el-tag type="danger" size="small">{{ row.reason }}</el-tag>
                </div>
                <div class="alert-name">{{ row.name }}</div>
                <div class="alert-card-footer">
                  <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
                  <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
                  <el-progress :percentage="row.progress" :stroke-width="5" style="flex:1;min-width:80px" />
                </div>
              </div>
            </div>
            <!-- 桌機版：表格 -->
            <el-table :data="alertList" size="small" stripe style="width:100%" max-height="260" class="alert-table">
              <el-table-column prop="itemNo" label="編號" width="90" />
              <el-table-column prop="name" label="場景名稱" min-width="160" show-overflow-tooltip />
              <el-table-column label="狀態" width="80">
                <template #default="{row}">
                  <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="進度" width="100">
                <template #default="{row}">
                  <el-progress :percentage="row.progress" :stroke-width="6" />
                </template>
              </el-table-column>
              <el-table-column label="優先序" width="70" align="center">
                <template #default="{row}">
                  <el-tag :type="priorityType(row.priority)" size="small">{{ row.priority }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="reason" label="預警原因" width="90">
                <template #default="{row}">
                  <el-tag type="danger" size="small">{{ row.reason }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="note" label="備註" min-width="160" show-overflow-tooltip />
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart, ScatterChart, TreemapChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import AppLayout from '@/components/AppLayout.vue'
import { dashboardApi, divisionsApi } from '@/api/index.js'
import { Refresh } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth.js'

use([CanvasRenderer, BarChart, PieChart, ScatterChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const auth = useAuthStore()
const loading = ref(false)
const kpi = ref({})
const allDivisions = ref([])   // 完整本部清單（供切換用）
const selectedDivisionId = ref(null)  // null = 全部
const selectedMethods = ref([])       // 開發方式複選，空 = 全選
const methodOptions = ['AI Agent', 'Claude', 'Gemini', 'NotebookLM', '系統開發', '其他工具']
const divisions = ref([])
const pieData = ref([])
const efficiencyGains = ref([])
const top5 = ref([])
const alertList = ref([])
const toolTreemap = ref([])

// admin / executive / chief 可切換本部
const canSwitchDivision = computed(() => auth.isAdmin || auth.isExecutive || auth.isChief)
// 後端已依 divisionId 過濾，直接顯示即可
const filteredDivisions = computed(() => divisions.value)

// 直接使用後端計算的所有場景直接平均（與 Weekly Tracking 一致）
const avgProgress = computed(() => kpi.value.avgProgress ?? 0)

// KPI 進度條百分比（集中管理，避免模板重複算式）
const pctScenes  = computed(() => Math.min(Math.round((kpi.value.effectiveCount / kpi.value.totalScenes) * 100) || 0, 100))
const pctActual  = computed(() => Math.min(Math.round(((kpi.value.actualMonthlyAvg || 0) * 12 / (kpi.value.annualizedSaved115 || 1)) * 100), 100))

const headcountReleaseRate = computed(() => {
  const saved = kpi.value.headcountSaved || 0
  // 用後端計算的人力基準（有填人數用人數，否則用 originalHours÷168 換算）
  const total = kpi.value.totalHeadcountBase || 0
  return total > 0 ? Math.min(Math.round((saved / total) * 100), 100) : 0
})

// 省時對比圖
const barChartOption = computed(() => {
  // 只顯示有時數資料（originalHours 或 savingHoursMonthly）的場景
  const data = efficiencyGains.value
    .filter(s => s.originalHours > 0 || s.savingHoursMonthly > 0)
    .slice(0, 20)

  // 改善後時數：優先用 improvedHours；若無則從 originalHours - savingHoursMonthly 推算
  const improvedData = data.map(s => {
    if (s.improvedHours > 0) return s.improvedHours
    if (s.savingHoursMonthly > 0 && s.originalHours > 0) {
      return Math.max(0, s.originalHours - s.savingHoursMonthly)
    }
    return 0
  })

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['原作業時數', '改善後預估時數'] },
    grid: { left: 40, right: 20, bottom: 60, top: 40 },
    xAxis: { type: 'category', data: data.map(s => s.itemNo || s.name), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value', name: '時數(h)' },
    series: [
      { name: '原作業時數', type: 'bar', data: data.map(s => s.originalHours), itemStyle: { color: '#e6a23c' }, label: { show: true, position: 'top', fontSize: 10, formatter: '{c}h' } },
      { name: '改善後預估時數', type: 'bar', data: improvedData, itemStyle: { color: '#67c23a' }, label: { show: true, position: 'top', fontSize: 10, formatter: '{c}h' } },
    ],
  }
})

// 本部分佈甜甜圈
const divisionPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
  series: [{
    type: 'pie', radius: ['40%', '70%'],
    data: filteredDivisions.value.filter(d => d.total > 0).map(d => ({ name: d.name, value: d.total })),
    label: { show: true, formatter: '{b}\n{c}個' },
    emphasis: { label: { show: true } },
    emphasis: { itemStyle: { shadowBlur: 10 } },
  }],
}))

// 開發方式圓餅圖
const methodPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0, textStyle: { fontSize: 11 } },
  series: [{
    type: 'pie', radius: ['35%', '65%'], center: ['50%', '45%'],
    data: pieData.value,
    label: { fontSize: 11, formatter: '{b}\n{c}個({d}%)' },
  }],
}))

// 優先序散佈圖
const priorityMap = { '高': 3, '中': 2, '低': 1 }
const scatterOption = computed(() => ({
  tooltip: { formatter: p => `${p.data[3]}<br>優先序: ${p.data[4]}<br>進度: ${p.data[1]}%<br>節省: ${p.data[2]}h` },
  xAxis: { type: 'category', data: ['低', '中', '高'], name: '優先序' },
  yAxis: { type: 'value', name: '進度(%)', max: 100 },
  series: [{
    type: 'scatter',
    data: efficiencyGains.value.map(s => [
      priorityMap[s.priority] - 1,
      s.progress,
      s.savedHours,
      s.name,
      s.priority,
    ]),
    symbolSize: d => Math.max(8, Math.min(d[2] / 5, 40)),
    itemStyle: { color: '#409eff', opacity: 0.7 },
  }],
}))

// 工具 Treemap
const treemapOption = computed(() => ({
  tooltip: { formatter: p => `${p.name}<br>使用場景數：${p.value}` },
  series: [{
    type: 'treemap',
    data: toolTreemap.value.map(t => ({ name: `${t.name}\n${t.value}個`, value: t.value })),
    leafDepth: 1,
    label: { show: true, fontSize: 12 },
    breadcrumb: { show: false },
  }],
}))


function priorityType(p) {
  return p === '高' ? 'danger' : p === '中' ? 'warning' : 'info'
}
function statusType(s) {
  if (s === '已完成') return 'success'
  if (s === '進行中') return 'primary'
  if (s === '規劃中') return 'info'
  return ''
}

async function load() {
  loading.value = true
  try {
    const params = {}
    if (selectedDivisionId.value) params.divisionId = selectedDivisionId.value
    if (selectedMethods.value.length > 0) params.developMethods = selectedMethods.value.join(',')
    const res = await dashboardApi.summary(params)
    kpi.value = res.data.kpi || {}
    divisions.value = res.data.divisions || []
    pieData.value = res.data.pieData || []
    efficiencyGains.value = res.data.efficiencyGains || []
    top5.value = res.data.top5 || []
    alertList.value = res.data.alertList || []
    toolTreemap.value = res.data.toolTreemap || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // 載入本部清單供切換
  try {
    const r = await divisionsApi.list()
    allDivisions.value = r.data
  } catch {}

  // chief / manager 不自動鎖定，預設全部本部（null）
  await load()
})
</script>

<style scoped>
.dashboard { padding: 0 0 40px; }
.dashboard-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
.section-title-row { display: flex; align-items: center; justify-content: space-between; margin: 24px 0 12px; flex-wrap: wrap; gap: 8px; }
.section-title { font-size: 16px; font-weight: 600; color: #303133; padding-left: 10px; border-left: 4px solid #409eff; margin: 0; }
.kpi-row { margin-bottom: 16px; }
.kpi-card { text-align: center; }
.kpi-card.green :deep(.el-card__body) { background: #f0f9eb; }
.kpi-card.blue :deep(.el-card__body) { background: #ecf5ff; }
.kpi-card.orange :deep(.el-card__body) { background: #fdf6ec; }
.kpi-card.yellow :deep(.el-card__body) { background: #fffbe6; }
.kpi-card.yellow .kpi-value { color: #d48806; }
.kpi-label { font-size: 13px; color: #909399; margin-bottom: 8px; }
.kpi-value { font-size: 36px; font-weight: 700; color: #303133; line-height: 1; }
.kpi-value small { font-size: 16px; font-weight: 400; color: #606266; }
.kpi-value--half { font-size: 26px; }
.kpi-value--half small { font-size: 13px; }
.kpi-value--actual { color: #e6a23c; }
.kpi-tag { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 10px; display: inline-block; margin-bottom: 4px; }
.kpi-tag--est { background: #f0f0f0; color: #606266; }
.kpi-tag--act { background: #fdf0d5; color: #b07d20; }
.kpi-sub { font-size: 12px; color: #909399; margin: 6px 0 8px; }
.kpi-progress { margin-top: 4px; }
.kpi-progress :deep(.el-progress__text) { font-size: 11px !important; }
.top5-item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
.top5-item:last-child { border-bottom: none; }
.top5-rank { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: #f0f0f0; color: #606266; flex-shrink: 0; }
.rank-1 { background: #f5c518; color: #fff; }
.rank-2 { background: #b0b0b0; color: #fff; }
.rank-3 { background: #cd7f32; color: #fff; }
.top5-info { flex: 1; margin: 0 10px; }
.top5-name { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
.top5-meta { display: flex; }
.top5-value { font-size: 20px; font-weight: 700; color: #409eff; white-space: nowrap; }
.top5-value small { font-size: 12px; color: #909399; }

/* 圖表 */
.chart-bar { height: 280px; }
.chart-pie { height: 280px; }

/* 各本部執行狀況：桌機顯示表格，手機顯示卡片 */
.division-cards { display: none; }
.division-table { display: table; }

/* 異常預警：桌機顯示表格，手機顯示卡片 */
.alert-cards { display: none; }
.alert-table { display: table; }

/* 本部卡片樣式（手機用） */
.division-card-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fafafa;
}
.division-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.division-name { font-size: 14px; font-weight: 600; color: #303133; }
.division-total { font-size: 12px; color: #909399; }
.division-tags { display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; }
.division-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.division-progress-label { font-size: 12px; color: #606266; white-space: nowrap; }
.division-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #606266;
}
.division-stats b { color: #303133; }

/* 預警卡片樣式（手機用） */
.alert-card-item {
  border: 1px solid #fde2e2;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fff8f8;
}
.alert-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.alert-itemno { font-size: 12px; font-weight: 600; color: #909399; }
.alert-name { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 6px; }
.alert-card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── 手機版 ── */
@media (max-width: 768px) {
  .dashboard { padding: 0 0 24px; }
  .page-title { font-size: 18px; }
  .section-title { font-size: 16px; margin: 18px 0 10px; }

  /* KPI 卡片手機版字體放大 */
  .kpi-value { font-size: 48px; }
  .kpi-value small { font-size: 20px; }
  .kpi-sub { font-size: 15px; }
  .kpi-label { font-size: 16px; margin-bottom: 8px; }

  /* 圖表高度縮小 */
  .chart-bar { height: 220px; }
  .chart-pie { height: 200px; }

  /* 切換為卡片式 */
  .division-cards { display: block; }
  .division-table { display: none !important; }

  .alert-cards { display: block; }
  .alert-table { display: none !important; }

  /* Top5 字體 */
  .top5-name { max-width: 100%; white-space: normal; font-size: 15px; }
  .top5-value { font-size: 20px; }
  .top5-rank { width: 32px; height: 32px; font-size: 15px; }

  /* 各本部卡片字體 */
  .division-name { font-size: 16px; }
  .division-total { font-size: 13px; }
  .division-tags .el-tag { font-size: 13px; }
  .division-stats { font-size: 14px; gap: 14px; }
  .division-progress-label { font-size: 14px; }

  /* 預警卡片字體 */
  .alert-name { font-size: 15px; }
  .alert-itemno { font-size: 13px; }
}
</style>
