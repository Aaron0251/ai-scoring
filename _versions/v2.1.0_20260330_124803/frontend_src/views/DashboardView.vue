<template>
  <AppLayout>
    <div class="dashboard">
      <h2 class="page-title">總覽 Dashboard</h2>

      <!-- KPI 卡片 -->
      <el-row :gutter="16" class="kpi-row">
        <el-col :span="6">
          <el-card class="kpi-card">
            <div class="kpi-label">場景總數</div>
            <div class="kpi-value">{{ kpi.totalScenes ?? '-' }}</div>
            <div class="kpi-sub">目標 {{ kpi.targetScenes }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="kpi-card green">
            <div class="kpi-label">已完成</div>
            <div class="kpi-value">{{ kpi.completedScenes ?? '-' }}</div>
            <div class="kpi-sub">完成率 {{ kpi.completionRate }}%</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="kpi-card blue">
            <div class="kpi-label">進行中</div>
            <div class="kpi-value">{{ kpi.inProgressScenes ?? '-' }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="kpi-card orange">
            <div class="kpi-label">預估省時（小時/月）</div>
            <div class="kpi-value">{{ kpi.estimatedTimeSaved?.toFixed(0) ?? '-' }}</div>
            <div class="kpi-sub">目標 {{ kpi.targetHours?.toLocaleString() }} 小時</div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 部門狀態表 -->
      <el-card class="mt-16">
        <template #header>部門推動狀態</template>
        <el-table :data="departments" stripe size="small">
          <el-table-column prop="division" label="本部" width="120" />
          <el-table-column prop="name" label="部門" width="140" />
          <el-table-column prop="total" label="場景數" width="80" align="center" />
          <el-table-column prop="completed" label="已完成" width="80" align="center">
            <template #default="{ row }">
              <el-tag type="success" size="small">{{ row.completed }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="inProgress" label="進行中" width="80" align="center">
            <template #default="{ row }">
              <el-tag type="primary" size="small">{{ row.inProgress }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="完成率" align="center">
            <template #default="{ row }">
              <el-progress
                :percentage="row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0"
                :stroke-width="8"
              />
            </template>
          </el-table-column>
          <el-table-column prop="timeSaved" label="預估省時(h)" width="110" align="right">
            <template #default="{ row }">{{ row.timeSaved?.toFixed(1) }}</template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { dashboardApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'

const kpi = ref({})
const departments = ref([])

onMounted(async () => {
  try {
    const res = await dashboardApi.summary()
    kpi.value = res.data.kpi
    departments.value = res.data.departments
  } catch (e) {
    console.error('Dashboard 載入失敗', e)
  }
})
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
.kpi-row { margin-bottom: 16px; }
.kpi-card { text-align: center; }
.kpi-card.green { border-top: 3px solid #67c23a; }
.kpi-card.blue  { border-top: 3px solid #409eff; }
.kpi-card.orange { border-top: 3px solid #e6a23c; }
.kpi-label { font-size: 13px; color: #888; margin-bottom: 8px; }
.kpi-value { font-size: 36px; font-weight: 700; line-height: 1.2; }
.kpi-sub { font-size: 12px; color: #aaa; margin-top: 4px; }
.mt-16 { margin-top: 16px; }
</style>
