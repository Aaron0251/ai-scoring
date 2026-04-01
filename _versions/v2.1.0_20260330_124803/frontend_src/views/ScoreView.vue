<template>
  <AppLayout>
    <div class="score-view">
      <h2 class="page-title">我的評分</h2>

      <el-select v-model="selectedPeriodId" placeholder="請選擇評核期別" style="width: 280px; margin-bottom: 16px" @change="loadScores">
        <el-option v-for="p in openPeriods" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>

      <el-empty v-if="!selectedPeriodId" description="請先選擇評核期別" />

      <template v-else>
        <!-- 教官評核 -->
        <el-card class="mb-16">
          <template #header>
            <div class="section-header">
              <span>教官評核</span>
              <el-input v-model="newTeacherName" placeholder="輸入教官姓名" style="width: 200px" />
              <el-button size="small" @click="addTeacher" :disabled="!newTeacherName">新增</el-button>
            </div>
          </template>
          <div v-for="teacher in teachers" :key="teacher" class="score-block">
            <h4>{{ teacher }}</h4>
            <el-table :data="criteriaForRole('教官')" size="small">
              <el-table-column prop="name" label="評核項目" />
              <el-table-column label="分數" width="200">
                <template #default="{ row }">
                  <el-input-number
                    v-model="scoreMap[`教官_${teacher}_${row.id}`]"
                    :min="0"
                    :max="row.maxScore"
                    :precision="0"
                    size="small"
                  />
                  <span style="margin-left:8px; color:#999">/ {{ row.maxScore }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>

        <!-- 直屬主管評核 -->
        <el-card class="mb-16">
          <template #header>直屬主管評核</template>
          <div v-if="deptPersons.length === 0">
            <el-empty description="無可評核的直屬主管（請聯絡管理員設定）" />
          </div>
          <div v-for="person in deptPersons" :key="person.id" class="score-block">
            <h4>{{ person.name }} <el-tag size="small">{{ person.role }}</el-tag></h4>
            <el-table :data="criteriaForRole('直屬主管')" size="small">
              <el-table-column prop="name" label="評核項目" />
              <el-table-column label="分數" width="200">
                <template #default="{ row }">
                  <el-input-number
                    v-model="scoreMap[`直屬主管_${person.id}_${row.id}`]"
                    :min="0"
                    :max="row.maxScore"
                    :precision="0"
                    size="small"
                  />
                  <span style="margin-left:8px; color:#999">/ {{ row.maxScore }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>

        <div style="text-align: right">
          <el-button :loading="saving" @click="handleSave">暫存</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">提交評分</el-button>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { periodsApi, criteriaApi, personScoresApi, deptPersonsApi } from '../api/index.js'
import { useAuthStore } from '../stores/auth.js'
import AppLayout from '../components/AppLayout.vue'

const auth = useAuthStore()
const openPeriods = ref([])
const selectedPeriodId = ref(null)
const criteria = ref([])
const deptPersons = ref([])
const teachers = ref([])
const newTeacherName = ref('')
const scoreMap = reactive({})
const saving = ref(false)
const submitting = ref(false)

onMounted(async () => {
  const res = await periodsApi.list()
  openPeriods.value = res.data.filter(p => p.isOpen)
})

async function loadScores() {
  if (!selectedPeriodId.value) return
  const [criRes, deptRes, scoreRes] = await Promise.all([
    criteriaApi.list({ periodId: selectedPeriodId.value }),
    deptPersonsApi.list({ departmentId: auth.user?.departmentId }),
    personScoresApi.list({ periodId: selectedPeriodId.value }),
  ])
  criteria.value = criRes.data
  deptPersons.value = deptRes.data

  // 從已存在的評分填入 scoreMap
  for (const s of scoreRes.data) {
    const key = s.subjectType === '教官'
      ? `教官_${s.subjectName}_${s.criterionId}`
      : `直屬主管_${s.deptPersonId}_${s.criterionId}`
    scoreMap[key] = s.score
    if (s.subjectType === '教官' && s.subjectName && !teachers.value.includes(s.subjectName)) {
      teachers.value.push(s.subjectName)
    }
  }
}

function criteriaForRole(role) {
  return criteria.value.filter(c => c.targetRole === role)
}

function addTeacher() {
  if (newTeacherName.value && !teachers.value.includes(newTeacherName.value)) {
    teachers.value.push(newTeacherName.value)
    newTeacherName.value = ''
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveAllScores()
    ElMessage.success('暫存成功')
  } finally {
    saving.value = false
  }
}

async function handleSubmit() {
  await ElMessageBox.confirm('確定提交本次所有評分？提交後不可修改。', '確認提交', { type: 'warning' })
  submitting.value = true
  try {
    await saveAllScores()
    await personScoresApi.submit(selectedPeriodId.value)
    ElMessage.success('評分已提交')
  } finally {
    submitting.value = false
  }
}

async function saveAllScores() {
  for (const [key, score] of Object.entries(scoreMap)) {
    if (score === null || score === undefined) continue
    const parts = key.split('_')
    if (parts[0] === '教官') {
      const subjectName = parts[1]
      const criterionId = parseInt(parts[2])
      await personScoresApi.save({
        periodId: selectedPeriodId.value,
        criterionId,
        subjectType: '教官',
        subjectName,
        score,
      })
    } else {
      const deptPersonId = parseInt(parts[1])
      const criterionId = parseInt(parts[2])
      await personScoresApi.save({
        periodId: selectedPeriodId.value,
        criterionId,
        subjectType: '直屬主管',
        deptPersonId,
        score,
      })
    }
  }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
.section-header { display: flex; align-items: center; gap: 8px; }
.score-block { margin-bottom: 16px; }
.score-block h4 { margin: 0 0 8px; font-size: 14px; }
.mb-16 { margin-bottom: 16px; }
</style>
