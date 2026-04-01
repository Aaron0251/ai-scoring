<template>
  <AppLayout>
    <div>
      <div class="toolbar">
        <h2 class="page-title">評核期別管理</h2>
        <el-button type="primary" @click="openCreate">+ 新增期別</el-button>
      </div>

      <el-table :data="periods" stripe v-loading="loading" size="small">
        <el-table-column prop="name" label="期別名稱" />
        <el-table-column label="開始日期" width="120">
          <template #default="{ row }">{{ fmtDate(row.startDate) }}</template>
        </el-table-column>
        <el-table-column label="截止日期" width="120">
          <template #default="{ row }">{{ fmtDate(row.endDate) }}</template>
        </el-table-column>
        <el-table-column label="狀態" width="105" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isOpen ? 'success' : 'info'">{{ row.isOpen ? '開放中' : '已關閉' }}</el-tag>
            <br />
            <el-button
              size="small"
              :type="row.isOpen ? 'warning' : 'success'"
              style="margin-top:4px"
              @click="toggleOpen(row)"
            >{{ row.isOpen ? '關閉' : '開放' }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openCriteria(row)">評核項目</el-button>
            <el-button size="small" type="danger" @click="deletePeriod(row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 新增期別對話框 -->
      <el-dialog v-model="showCreate" title="新增評核期別" width="440px">
        <el-form :model="createForm" label-width="100px">
          <el-form-item label="名稱">
            <el-input v-model="createForm.name" />
          </el-form-item>
          <el-form-item label="開始日期">
            <el-date-picker v-model="createForm.startDate" type="date" style="width:100%" />
          </el-form-item>
          <el-form-item label="結束日期">
            <el-date-picker v-model="createForm.endDate" type="date" style="width:100%" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showCreate = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="handleCreate">建立</el-button>
        </template>
      </el-dialog>

      <!-- 評核項目管理 -->
      <el-dialog v-model="showCriteria" :title="`評核項目 — ${selectedPeriod?.name}`" width="600px">
        <el-button size="small" type="primary" @click="addCriterion" style="margin-bottom:12px">+ 新增項目</el-button>
        <el-table :data="currentCriteria" size="small">
          <el-table-column prop="name" label="項目名稱" />
          <el-table-column prop="targetRole" label="目標角色" width="100" />
          <el-table-column prop="maxScore" label="滿分" width="70" align="center" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="deleteCriterion(row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 新增評核項目表單 -->
        <div v-if="showAddCriterion" class="add-criterion-form">
          <el-divider />
          <el-form :model="criterionForm" label-width="90px" size="small">
            <el-form-item label="名稱">
              <el-input v-model="criterionForm.name" />
            </el-form-item>
            <el-form-item label="目標角色">
              <el-input v-model="criterionForm.targetRole" placeholder="如：教官、直屬主管" />
            </el-form-item>
            <el-form-item label="滿分">
              <el-input-number v-model="criterionForm.maxScore" :min="1" :max="100" />
            </el-form-item>
          </el-form>
          <div style="text-align:right">
            <el-button size="small" @click="showAddCriterion = false">取消</el-button>
            <el-button size="small" type="primary" :loading="saving" @click="saveCriterion">新增</el-button>
          </div>
        </div>
      </el-dialog>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { periodsApi, criteriaApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'

const periods = ref([])
const loading = ref(false)
const saving = ref(false)
const showCreate = ref(false)
const showCriteria = ref(false)
const showAddCriterion = ref(false)
const selectedPeriod = ref(null)
const currentCriteria = ref([])

const createForm = reactive({ name: '', startDate: null, endDate: null })
const criterionForm = reactive({ name: '', targetRole: '', maxScore: 10 })

onMounted(loadPeriods)

async function loadPeriods() {
  loading.value = true
  try {
    const res = await periodsApi.list()
    periods.value = res.data
  } finally { loading.value = false }
}

function openCreate() { Object.assign(createForm, { name: '', startDate: null, endDate: null }); showCreate.value = true }

async function handleCreate() {
  if (!createForm.name || !createForm.startDate || !createForm.endDate) {
    return ElMessage.warning('請填寫所有欄位')
  }
  saving.value = true
  try {
    await periodsApi.create(createForm)
    ElMessage.success('建立成功')
    showCreate.value = false
    loadPeriods()
  } finally { saving.value = false }
}

async function toggleOpen(period) {
  await periodsApi.update(period.id, { isOpen: !period.isOpen })
  period.isOpen = !period.isOpen
}

async function deletePeriod(period) {
  await ElMessageBox.confirm(`確定刪除「${period.name}」？`, '確認', { type: 'warning' })
  await periodsApi.remove(period.id)
  ElMessage.success('已刪除')
  loadPeriods()
}

async function openCriteria(period) {
  selectedPeriod.value = period
  const res = await criteriaApi.list({ periodId: period.id })
  currentCriteria.value = res.data
  showCriteria.value = true
}

function addCriterion() {
  Object.assign(criterionForm, { name: '', targetRole: '', maxScore: 10 })
  showAddCriterion.value = true
}

async function saveCriterion() {
  if (!criterionForm.name) return ElMessage.warning('請輸入項目名稱')
  saving.value = true
  try {
    await criteriaApi.create({ ...criterionForm, periodId: selectedPeriod.value.id })
    const res = await criteriaApi.list({ periodId: selectedPeriod.value.id })
    currentCriteria.value = res.data
    showAddCriterion.value = false
    ElMessage.success('已新增')
  } finally { saving.value = false }
}

async function deleteCriterion(c) {
  await ElMessageBox.confirm(`確定刪除「${c.name}」？`, '確認', { type: 'warning' })
  await criteriaApi.remove(c.id)
  currentCriteria.value = currentCriteria.value.filter(x => x.id !== c.id)
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('zh-TW') : '-' }
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; }
.add-criterion-form { margin-top: 8px; }
</style>
