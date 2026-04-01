<template>
  <AppLayout>
    <div v-loading="loading">
      <div class="toolbar">
        <el-breadcrumb>
          <el-breadcrumb-item :to="{ path: '/scenes' }">場景管理</el-breadcrumb-item>
          <el-breadcrumb-item>{{ scene?.itemNo }} {{ scene?.sceneName }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div v-if="auth.isAdmin || auth.isManager">
          <el-button v-if="!editing" type="primary" @click="startEdit">編輯</el-button>
          <template v-else>
            <el-button @click="cancelEdit">取消</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">儲存</el-button>
          </template>
        </div>
      </div>

      <el-tabs v-if="scene" v-model="activeTab">

        <!-- ── Tab 1：基本資訊 ───────────────────── -->
        <el-tab-pane label="基本資訊" name="tab1">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="項目編號">{{ scene.itemNo }}</el-descriptions-item>
            <el-descriptions-item label="所屬本部">{{ scene.department?.division?.name || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所屬部門">{{ scene.department?.name }}</el-descriptions-item>
            <el-descriptions-item label="所屬課別">
              <el-select v-if="editing" v-model="form.sectionId" clearable placeholder="（選填）" style="width:100%">
                <el-option v-for="s in sections" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
              <span v-else>{{ scene.section?.name || '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="場景名稱" :span="2">
              <el-input v-if="editing" v-model="form.sceneName" maxlength="100" show-word-limit />
              <span v-else>{{ scene.sceneName }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="維持 / 開發 / 作廢">
              <el-select v-if="editing" v-model="form.maintainOrDevelop" clearable style="width:100%">
                <el-option label="維持" value="維持" />
                <el-option label="開發" value="開發" />
                <el-option label="作廢" value="作廢" />
              </el-select>
              <span v-else>{{ scene.maintainOrDevelop || '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="開發方式">
              <el-select v-if="editing" v-model="form.developMethod" clearable style="width:100%">
                <el-option label="AI Agent" value="AI Agent" />
                <el-option label="系統開發" value="系統開發" />
                <el-option label="自行開發" value="自行開發" />
                <el-option label="其他工具" value="其他工具" />
              </el-select>
              <span v-else>{{ scene.developMethod || '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item v-if="editing ? form.developMethod === '其他工具' : scene.developMethod === '其他工具'" label="開發工具說明" :span="2">
              <el-input v-if="editing" v-model="form.developToolDesc" maxlength="200" show-word-limit />
              <span v-else>{{ scene.developToolDesc || '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="AI Agent 用途分類">
              <el-input v-if="editing" v-model="form.agentCategory" maxlength="100" />
              <span v-else>{{ scene.agentCategory || '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="是否由資訊協助完成">
              <el-select v-if="editing" v-model="form.itAssisted" clearable style="width:100%">
                <el-option label="是" :value="true" />
                <el-option label="否" :value="false" />
              </el-select>
              <template v-else>
                <el-tag v-if="scene.itAssisted === true" type="success" size="small">是</el-tag>
                <el-tag v-else-if="scene.itAssisted === false" type="info" size="small">否</el-tag>
                <span v-else>未設定</span>
              </template>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <!-- ── Tab 2：需求與執行 ──────────────────── -->
        <el-tab-pane label="需求與執行" name="tab2">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="(輸入) 常見問項 / 希望 AI 處理什麼">
              <el-input v-if="editing" v-model="form.inputDesc" type="textarea" :rows="3" maxlength="1000" show-word-limit />
              <pre v-else class="pre-text">{{ scene.inputDesc || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="(輸出) 預期輸出成果">
              <el-input v-if="editing" v-model="form.outputDesc" type="textarea" :rows="3" maxlength="1000" show-word-limit />
              <pre v-else class="pre-text">{{ scene.outputDesc || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="任務步驟或處理邏輯">
              <el-input v-if="editing" v-model="form.taskSteps" type="textarea" :rows="4" maxlength="2000" show-word-limit />
              <pre v-else class="pre-text">{{ scene.taskSteps || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="原始資料範例說明">
              <el-input v-if="editing" v-model="form.rawDataExample" type="textarea" :rows="3" maxlength="1000" show-word-limit />
              <pre v-else class="pre-text">{{ scene.rawDataExample || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="最終資料範例說明">
              <el-input v-if="editing" v-model="form.finalDataExample" type="textarea" :rows="3" maxlength="1000" show-word-limit />
              <pre v-else class="pre-text">{{ scene.finalDataExample || '-' }}</pre>
            </el-descriptions-item>
          </el-descriptions>
          <el-descriptions :column="3" border size="small" style="margin-top:12px">
            <el-descriptions-item label="每次執行耗費時間">
              <el-input v-if="editing" v-model="form.timePerExecution" maxlength="50" />
              <span v-else>{{ scene.timePerExecution ?? '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="每月執行頻率">
              <el-input v-if="editing" v-model="form.monthlyFrequency" maxlength="50" />
              <span v-else>{{ scene.monthlyFrequency ?? '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="有需求的人數">
              <el-input-number v-if="editing" v-model="form.demandCount" :min="0" :precision="0" style="width:100%" />
              <span v-else>{{ scene.demandCount ?? '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <!-- ── Tab 3：負責人 ──────────────────────── -->
        <el-tab-pane label="負責人" name="tab3">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="任務負責人（多人以逗號分隔）">
              <el-input v-if="editing" v-model="form.taskOwners" maxlength="500" placeholder="例：王小明, 李大華" />
              <span v-else>{{ scene.taskOwners || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="種子負責人（多人以逗號分隔）">
              <el-input v-if="editing" v-model="form.seedOwners" maxlength="500" placeholder="例：張三, 李四" />
              <span v-else>{{ scene.seedOwners || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="輬導主管">
              <el-select v-if="editing" v-model="form.directSupervisor" clearable filterable allow-create style="width:100%" placeholder="從部門主管清單選取或直接輸入">
                <el-option v-for="p in deptPersons" :key="p.id" :label="`${p.name}${p.title ? '（' + p.title + '）' : ''}`" :value="p.name" />
              </el-select>
              <span v-else>{{ scene.directSupervisor || '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <!-- ── Tab 4：管理與成效 ──────────────────── -->
        <el-tab-pane label="管理與成效" name="tab4">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="優先序">
              <el-select v-if="editing" v-model="form.priority" style="width:100%">
                <el-option label="高" value="高" />
                <el-option label="中" value="中" />
                <el-option label="低" value="低" />
              </el-select>
              <el-tag v-else :type="priorityType(scene.priority)" size="small">{{ scene.priority }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="狀態">
              <el-select v-if="editing" v-model="form.status" style="width:100%">
                <el-option label="規劃中" value="規劃中" />
                <el-option label="進行中" value="進行中" />
                <el-option label="已完成" value="已完成" />
                <el-option label="暫停" value="暫停" />
              </el-select>
              <el-tag v-else :type="statusType(scene.status)" size="small">{{ scene.status }}</el-tag>
            </el-descriptions-item>

            <el-descriptions-item label="進度" :span="2">
              <el-slider v-if="editing" v-model="form.progress" :max="100" show-input />
              <el-progress v-else :percentage="scene.progress" />
            </el-descriptions-item>

            <el-descriptions-item label="成立日">
              <el-date-picker v-if="editing" v-model="form.establishDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              <span v-else>{{ formatDate(scene.establishDate) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="預計完成日">
              <el-date-picker v-if="editing" v-model="form.targetDate" type="date" value-format="YYYY-MM-DD" style="width:100%" />
              <span v-else>{{ formatDate(scene.targetDate) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="實際完成日（自動填入）">
              <span>{{ formatDate(scene.completedDate) || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="上線日期時間">
              <el-date-picker v-if="editing" v-model="form.goLiveDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width:100%" />
              <span v-else>{{ formatDate(scene.goLiveDate) }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="預估節省時數（每月，h）">
              <el-input-number v-if="editing" v-model="form.timeSavedHours" :min="0" :max="9999.9" :precision="1" style="width:100%" />
              <span v-else>{{ scene.timeSavedHours ?? '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="實際節省時數（每月，h）">
              <el-input-number v-if="editing" v-model="form.actualTimeSavedHours" :min="0" :max="9999.9" :precision="1" style="width:100%" />
              <span v-else>{{ scene.actualTimeSavedHours ?? '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="效率提升 %（自動計算）">
              <span>{{ scene.efficiencyGainPct != null ? scene.efficiencyGainPct + ' %' : '—' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="實際需求人數">
              <el-input-number v-if="editing" v-model="form.actualDemandCount" :min="0" :precision="0" style="width:100%" />
              <span v-else>{{ scene.actualDemandCount ?? '-' }}</span>
            </el-descriptions-item>

            <el-descriptions-item label="文字成效說明" :span="2">
              <el-input v-if="editing" v-model="form.resultText" type="textarea" :rows="2" />
              <pre v-else class="pre-text">{{ scene.resultText || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="上線實際成效說明" :span="2">
              <el-input v-if="editing" v-model="form.actualResultText" type="textarea" :rows="2" />
              <pre v-else class="pre-text">{{ scene.actualResultText || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="其他量化成效說明" :span="2">
              <el-input v-if="editing" v-model="form.otherMetrics" type="textarea" :rows="2" />
              <pre v-else class="pre-text">{{ scene.otherMetrics || '-' }}</pre>
            </el-descriptions-item>
            <el-descriptions-item label="備註" :span="2">
              <el-input v-if="editing" v-model="form.note" type="textarea" :rows="2" />
              <pre v-else class="pre-text">{{ scene.note || '-' }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

      </el-tabs>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { scenesApi, sectionsApi, deptPersonsApi } from '../api/index.js'
import { useAuthStore } from '../stores/auth.js'
import AppLayout from '../components/AppLayout.vue'

const auth = useAuthStore()
const route = useRoute()
const scene = ref(null)
const loading = ref(false)
const editing = ref(route.query.edit === '1')
const saving = ref(false)
const activeTab = ref('tab1')
const sections = ref([])
const deptPersons = ref([])
const form = reactive({})

onMounted(async () => {
  loading.value = true
  try {
    const res = await scenesApi.get(route.params.id)
    scene.value = res.data
    fillForm(res.data)
    // 載入課別與主管清單
    await Promise.all([
      loadSections(res.data.departmentId),
      loadDeptPersons(res.data.departmentId),
    ])
  } finally {
    loading.value = false
  }
})

async function loadSections(deptId) {
  if (!deptId) return
  try {
    const r = await sectionsApi.list({ departmentId: deptId })
    sections.value = r.data
  } catch {}
}

async function loadDeptPersons(deptId) {
  if (!deptId) return
  try {
    const r = await deptPersonsApi.list({ departmentId: deptId })
    deptPersons.value = r.data
  } catch {}
}

function fillForm(d) {
  Object.assign(form, {
    sceneName: d.sceneName,
    sectionId: d.sectionId ?? null,
    maintainOrDevelop: d.maintainOrDevelop ?? null,
    developMethod: d.developMethod ?? null,
    developToolDesc: d.developToolDesc ?? null,
    agentCategory: d.agentCategory ?? null,
    itAssisted: d.itAssisted ?? null,
    // Tab2
    inputDesc: d.inputDesc ?? null,
    outputDesc: d.outputDesc ?? null,
    taskSteps: d.taskSteps ?? null,
    rawDataExample: d.rawDataExample ?? null,
    finalDataExample: d.finalDataExample ?? null,
    timePerExecution: d.timePerExecution ?? null,
    monthlyFrequency: d.monthlyFrequency ?? null,
    demandCount: d.demandCount ?? null,
    // Tab3
    taskOwners: d.taskOwners ?? null,
    seedOwners: d.seedOwners ?? null,
    directSupervisor: d.directSupervisor ?? null,
    // Tab4
    priority: d.priority,
    status: d.status,
    progress: d.progress,
    establishDate: d.establishDate ? d.establishDate.substring(0, 10) : null,
    targetDate: d.targetDate ? d.targetDate.substring(0, 10) : null,
    goLiveDate: d.goLiveDate ? d.goLiveDate.substring(0, 19) : null,
    timeSavedHours: d.timeSavedHours ?? null,
    actualTimeSavedHours: d.actualTimeSavedHours ?? null,
    actualDemandCount: d.actualDemandCount ?? null,
    resultText: d.resultText ?? null,
    actualResultText: d.actualResultText ?? null,
    otherMetrics: d.otherMetrics ?? null,
    note: d.note ?? null,
  })
}

function startEdit() {
  editing.value = true
}

function cancelEdit() {
  fillForm(scene.value)
  editing.value = false
}

async function handleSave() {
  if (!form.sceneName?.trim()) {
    ElMessage.warning('場景名稱為必填')
    return
  }
  saving.value = true
  try {
    const res = await scenesApi.update(route.params.id, form)
    scene.value = res.data
    editing.value = false
    ElMessage.success('儲存成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '儲存失敗')
  } finally {
    saving.value = false
  }
}

function formatDate(d) {
  if (!d) return '-'
  return d.substring(0, 10)
}

function statusType(s) {
  return { '已完成': 'success', '進行中': 'primary', '暫停': 'warning', '規劃中': 'info' }[s] || ''
}
function priorityType(p) {
  return { '高': 'danger', '中': 'warning', '低': 'info' }[p] || ''
}
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.pre-text { white-space: pre-wrap; margin: 0; font-family: inherit; line-height: 1.5; }
</style>
