<template>
  <AppLayout>
    <h2 class="page-title">評核報表</h2>
    <el-select v-model="selectedPeriodId" placeholder="請選擇期別" style="width:280px; margin-bottom:16px" @change="loadReport">
      <el-option v-for="p in periods" :key="p.id" :label="p.name" :value="p.id" />
    </el-select>
    <el-empty v-if="!selectedPeriodId" description="請選擇評核期別" />
    <el-table v-else :data="report" v-loading="loading" stripe size="small">
      <el-table-column label="受評對象" width="120">
        <template #default="{ row }">{{ row.subjectName }}</template>
      </el-table-column>
      <el-table-column label="類型" width="90">
        <template #default="{ row }">
          <el-tag size="small">{{ row.subjectType }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-for="c in criteriaNames" :key="c" :label="c" align="center" width="110">
        <template #default="{ row }">
          {{ row.criteriaAvg?.find(x => x.criterionName === c)?.avg ?? '-' }}
        </template>
      </el-table-column>
    </el-table>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { periodsApi, personScoresApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'

const periods = ref([])
const selectedPeriodId = ref(null)
const report = ref([])
const loading = ref(false)
const criteriaNames = computed(() => {
  const names = new Set()
  for (const r of report.value) {
    for (const c of r.criteriaAvg || []) names.add(c.criterionName)
  }
  return [...names]
})

onMounted(async () => {
  const res = await periodsApi.list()
  periods.value = res.data
})

async function loadReport() {
  if (!selectedPeriodId.value) return
  loading.value = true
  try {
    const res = await personScoresApi.report({ periodId: selectedPeriodId.value })
    report.value = res.data
  } finally { loading.value = false }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
