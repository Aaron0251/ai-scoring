<template>
  <AppLayout>
    <h2 class="page-title">效率評估管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="showCreate = true">+ 新增期別</el-button>

    <el-table :data="periods" stripe v-loading="loading" size="small">
      <el-table-column prop="name" label="名稱" />
      <el-table-column prop="frequency" label="頻率" width="80" />
      <el-table-column label="起訖" width="200">
        <template #default="{ row }">{{ fmtDate(row.startDate) }} ~ {{ fmtDate(row.endDate) }}</template>
      </el-table-column>
      <el-table-column label="截止日" width="110">
        <template #default="{ row }">{{ row.dueDate ? fmtDate(row.dueDate) : '-' }}</template>
      </el-table-column>
      <el-table-column label="狀態" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isOpen ? 'success' : 'info'" size="small">{{ row.isOpen ? '開放' : '關閉' }}</el-tag>
          <el-tag v-if="row.scoreGenerated" type="warning" size="small" style="margin-left:4px">已產生</el-tag>
          <br />
          <el-button
            size="small"
            :type="row.isOpen ? 'warning' : 'success'"
            style="margin-top:4px"
            @click="toggleOpen(row)"
          >{{ row.isOpen ? '關閉' : '開放' }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170">
        <template #default="{ row }">
          <el-button size="small" type="primary" :disabled="row.scoreGenerated" @click="generate(row)">產生評分表</el-button>
          <el-button size="small" type="danger" @click="remove(row)">刪除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showCreate" title="新增效率評估期別" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="名稱"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="頻率">
          <el-select v-model="form.frequency">
            <el-option label="週評" value="週評" />
            <el-option label="月評" value="月評" />
          </el-select>
        </el-form-item>
        <el-form-item label="開始日期"><el-date-picker v-model="form.startDate" type="date" style="width:100%" /></el-form-item>
        <el-form-item label="結束日期"><el-date-picker v-model="form.endDate" type="date" style="width:100%" /></el-form-item>
        <el-form-item label="截止日期"><el-date-picker v-model="form.dueDate" type="date" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleCreate">建立</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { efficiencyPeriodsApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'

const periods = ref([])
const loading = ref(false)
const saving = ref(false)
const showCreate = ref(false)
const form = reactive({ name: '', frequency: '月評', startDate: null, endDate: null, dueDate: null })

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await efficiencyPeriodsApi.list()
    periods.value = res.data
  } finally { loading.value = false }
}

async function handleCreate() {
  saving.value = true
  try {
    await efficiencyPeriodsApi.create(form)
    ElMessage.success('建立成功')
    showCreate.value = false
    load()
  } finally { saving.value = false }
}

async function toggleOpen(p) {
  await efficiencyPeriodsApi.update(p.id, { isOpen: !p.isOpen })
  p.isOpen = !p.isOpen
}

async function generate(p) {
  await ElMessageBox.confirm('確定為此期別產生評分表？', '確認', { type: 'warning' })
  await efficiencyPeriodsApi.generate(p.id)
  ElMessage.success('評分表已產生')
  p.scoreGenerated = true
}

async function remove(p) {
  await ElMessageBox.confirm(`確定刪除「${p.name}」？`, '確認', { type: 'warning' })
  await efficiencyPeriodsApi.remove(p.id)
  ElMessage.success('已刪除')
  load()
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('zh-TW') : '-' }
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
