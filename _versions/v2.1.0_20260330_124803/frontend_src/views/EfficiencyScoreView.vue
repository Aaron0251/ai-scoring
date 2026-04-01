<template>
  <AppLayout>
    <h2 class="page-title">效率評分</h2>
    <el-select v-model="selectedPeriodId" placeholder="請選擇期別" style="width:280px; margin-bottom:16px" @change="loadEvals">
      <el-option v-for="p in periods" :key="p.id" :label="p.name" :value="p.id" />
    </el-select>
    <el-table v-if="evals.length" :data="evals" stripe size="small">
      <el-table-column prop="criterion.name" label="評核項目" />
      <el-table-column label="分數" width="200">
        <template #default="{ row }">
          <el-input-number v-model="scoreMap[row.id]" :min="0" :max="row.criterion?.maxScore || 10" size="small" />
        </template>
      </el-table-column>
    </el-table>
    <div v-if="evals.length" style="text-align:right; margin-top:12px">
      <el-button :loading="saving" @click="saveAll">暫存</el-button>
      <el-button type="primary" :loading="submitting" @click="submitAll">提交</el-button>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { efficiencyPeriodsApi, efficiencyEvalsApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'

const periods = ref([])
const selectedPeriodId = ref(null)
const evals = ref([])
const scoreMap = reactive({})
const saving = ref(false)
const submitting = ref(false)

onMounted(async () => {
  const res = await efficiencyPeriodsApi.list()
  periods.value = res.data.filter(p => p.isOpen)
})

async function loadEvals() {
  if (!selectedPeriodId.value) return
  const res = await efficiencyEvalsApi.list({ periodId: selectedPeriodId.value })
  evals.value = res.data
  for (const e of res.data) scoreMap[e.id] = e.score
}

async function saveAll() {
  saving.value = true
  try {
    for (const [id, score] of Object.entries(scoreMap)) {
      await efficiencyEvalsApi.update(id, { score })
    }
    ElMessage.success('暫存成功')
  } finally { saving.value = false }
}

async function submitAll() {
  await ElMessageBox.confirm('確定提交本次所有效率評分？', '確認', { type: 'warning' })
  submitting.value = true
  try {
    await saveAll()
    await efficiencyEvalsApi.submit(selectedPeriodId.value)
    ElMessage.success('提交成功')
  } finally { submitting.value = false }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
