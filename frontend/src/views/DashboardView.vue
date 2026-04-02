<template>
  <AppLayout>
    <div class="dashboard" v-loading="loading">
      <div class="dashboard-header">
        <h2 class="page-title">AI 推動評分 Dashboard</h2>
        <el-button @click="load" :loading="loading" size="small" plain>
          <el-icon><Refresh /></el-icon> 重新整理
        </el-button>
      </div>

      <!-- ① 核心 KPI 總覽 -->
      <div class="section-title">核心 KPI 總覽</div>
      <el-row :gutter="16" class="kpi-row">
        <el-col :xs="12" :sm="6">
          <el-card class="kpi-card">
            <div class="kpi-label">專案總數</div>
            <div class="kpi-value">{{ kpi.totalScenes ?? '-' }}</div>
            <div class="kpi-sub">上線 {{ kpi.effectiveCount }} / 目標 {{ kpi.targetScenes }}</div>
            <el-progress :percentage="Math.min(Math.round((kpi.totalScenes/kpi.targetScenes)*100)||0,100)" :stroke-width="6" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="6">
          <el-card class="kpi-card orange">
            <div class="kpi-label">預估節省時數（月）</div>
            <div class="kpi-value">{{ kpi.estimatedTimeSaved?.toFixed(0) ?? '-' }} <small>h</small></div>
            <div class="kpi-sub">年化 {{ ((kpi.estimatedTimeSaved||0)*12).toFixed(0) }} h／目標 {{ kpi.targetHours?.toLocaleString() }}</div>
            <el-progress :percentage="Math.min(Math.round((kpi.estimatedTimeSaved/kpi.targetHours)*100)||0,100)" :stroke-width="6" status="warning" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="6">
          <el-card class="kpi-card blue">
            <div class="kpi-label">平均進度</div>
            <div class="kpi-value">{{ avgProgress }} <small>%</small></div>
            <div class="kpi-sub">進行中 {{ kpi.inProgressScenes }}　規劃中 {{ kpi.plannedScenes }}</div>
            <el-progress :percentage="avgProgress" :stroke-width="6" class="kpi-progress" />
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="6">
          <el-card class="kpi-card green">
            <div class="kpi-label">人力釋放率</div>
            <div class="kpi-value">{{ headcountReleaseRate }} <small>%</small></div>
            <div class="kpi-sub">節省人數 {{ kpi.headcountSaved }} 人</div>
            <el-progress :percentage="headcountReleaseRate" :stroke-width="6" status="success" class="kpi-progress" />
          </el-card>
        </el-col>
      </el-row>

      <!-- ② 成效分析 -->
      <div class="section-title">成效分析：省時與效率</div>
      <el-row :gutter="16" style="margin-bottom:16px">
        <!-- 省時對比圖 -->
        <el-col :span="16">
          <el-card>
            <template #header><span>省時對比圖（原作業 vs 改善後預估）</span></template>
            <v-chart :option="barChartOption" style="height:280px" autoresize />
          </el-card>
        </el-col>
        <!-- Top 5 高價值排行 -->
        <el-col :span="8">
          <el-card style="height:100%">
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
        <el-col :span="8">
          <el-card>
            <template #header><span>本部專案分佈</span></template>
            <v-chart :option="divisionPieOption" style="height:280px" autoresize />
          </el-card>
        </el-col>
        <!-- 部門開發成熟度 Heatmap -->
        <el-col :span="16">
          <el-card>
            <template #header><span>各本部執行狀況</span></template>
            <el-table :data="divisions" size="small" stripe style="width:100%">
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
              <el-table-column label="預估節省(h)" align="right" min-width="100">
                <template #default="{row}">{{ row.estimatedSaved.toFixed(0) }}</template>
              </el-table-column>
              <el-table-column label="實際節省(h)" align="right" min-width="100">
                <template #default="{row}">{{ row.actualSavingsTotal.toFixed(0) }}</template>
              </el-table-column>
              <el-table-column label="節省人數" align="right" width="80">
                <template #default="{row}">{{ row.headcountSaved }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- ④ 進度與時程監控 -->
      <div class="section-title">進度與時程監控</div>
      <el-row :gutter="16">
        <!-- 開發方式圓餅圖 -->
        <el-col :span="8">
          <el-card>
            <template #header><span>開發方式分佈</span></template>
            <v-chart :option="methodPieOption" style="height:280px" autoresize />
          </el-card>
        </el-col>
        <!-- 異常預警清單 -->
        <el-col :span="16">
          <el-card>
            <template #header>
              <span>⚠️ 異常預警清單</span>
              <el-tag type="danger" size="small" style="margin-left:8px">{{ alertList.length }}</el-tag>
            </template>
            <el-table :data="alertList" size="small" stripe style="width:100%" max-height="260">
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
import { dashboardApi } from '@/api/index.js'
import { Refresh } from '@element-plus/icons-vue'

use([CanvasRenderer, BarChart, PieChart, ScatterChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const loading = ref(false)
const kpi = ref({})
const divisions = ref([])
const pieData = ref([])
const efficiencyGains = ref([])
const top5 = ref([])
const alertList = ref([])
const toolTreemap = ref([])

const avgProgress = computed(() => {
  if (!divisions.value.length) return 0
  return Math.round(divisions.value.reduce((s, d) => s + d.avgProgress, 0) / divisions.value.length)
})

const headcountReleaseRate = computed(() => {
  const total = efficiencyGains.value.reduce((s, r) => s + r.originalHeadcount, 0)
  const saved = kpi.value.headcountSaved || 0
  return total > 0 ? Math.min(Math.round((saved / total) * 100), 100) : 0
})

// 省時對比圖
const barChartOption = computed(() => {
  const data = efficiencyGains.value.slice(0, 20)
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['原作業時數', '改善後預估時數'] },
    grid: { left: 40, right: 20, bottom: 60, top: 40 },
    xAxis: { type: 'category', data: data.map(s => s.itemNo || s.name), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value', name: '時數(h)' },
    series: [
      { name: '原作業時數', type: 'bar', data: data.map(s => s.originalHours), itemStyle: { color: '#e6a23c' }, label: { show: true, position: 'top', fontSize: 10, formatter: '{c}h' } },
      { name: '改善後預估時數', type: 'bar', data: data.map(s => s.improvedHours), itemStyle: { color: '#67c23a' }, label: { show: true, position: 'top', fontSize: 10, formatter: '{c}h' } },
    ],
  }
})

// 本部分佈甜甜圈
const divisionPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { fontSize: 11 } },
  series: [{
    type: 'pie', radius: ['40%', '70%'],
    data: divisions.value.filter(d => d.total > 0).map(d => ({ name: d.name, value: d.total })),
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
    const res = await dashboardApi.summary()
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

onMounted(load)
</script>

<style scoped>
.dashboard { padding: 0 0 40px; }
.dashboard-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 22px; font-weight: 700; }
.section-title { font-size: 16px; font-weight: 600; color: #303133; margin: 24px 0 12px; padding-left: 10px; border-left: 4px solid #409eff; }
.kpi-row { margin-bottom: 16px; }
.kpi-card { text-align: center; }
.kpi-card.green :deep(.el-card__body) { background: #f0f9eb; }
.kpi-card.blue :deep(.el-card__body) { background: #ecf5ff; }
.kpi-card.orange :deep(.el-card__body) { background: #fdf6ec; }
.kpi-label { font-size: 13px; color: #909399; margin-bottom: 8px; }
.kpi-value { font-size: 36px; font-weight: 700; color: #303133; line-height: 1; }
.kpi-value small { font-size: 16px; font-weight: 400; color: #606266; }
.kpi-sub { font-size: 12px; color: #909399; margin: 6px 0 8px; }
.kpi-progress { margin-top: 4px; }
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
</style>
