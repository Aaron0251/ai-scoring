<template>
  <AppLayout>
    <h2 class="page-title">組織架構管理</h2>

    <el-tabs>
      <!-- 本部管理 -->
      <el-tab-pane label="本部">
        <el-button class="add-btn" type="primary" @click="openAdd('division')">+ 新增本部</el-button>
        <el-table :data="divisions" stripe size="small">
          <el-table-column prop="name" label="本部名稱" width="180" />
          <el-table-column label="人員">
            <template #default="{ row }">
              <span v-for="p in personsOf('division', row.id)" :key="p.id" class="person-tag">
                {{ p.name }}{{ p.title ? `（${p.title}）` : '' }}
              </span>
              <span v-if="personsOf('division', row.id).length === 0" class="no-person">未設定</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="openEditDiv(row)">編輯</el-button>
              <el-button size="small" type="danger" @click="removeDiv(row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 部門管理 -->
      <el-tab-pane label="部門">
        <el-button class="add-btn" type="primary" @click="openAdd('dept')">+ 新增部門</el-button>
        <el-table :data="departments" stripe size="small">
          <el-table-column label="本部" width="150">
            <template #default="{ row }">{{ row.division?.name }}</template>
          </el-table-column>
          <el-table-column prop="name" label="部門名稱" width="180" />
          <el-table-column label="人員">
            <template #default="{ row }">
              <span v-for="p in personsOf('department', row.id)" :key="p.id" class="person-tag">
                {{ p.name }}{{ p.title ? `（${p.title}）` : '' }}
              </span>
              <span v-if="personsOf('department', row.id).length === 0" class="no-person">未設定</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="openEditDept(row)">編輯</el-button>
              <el-button size="small" type="danger" @click="removeDept(row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 課級管理 -->
      <el-tab-pane label="課級">
        <el-button class="add-btn" type="primary" @click="openAdd('section')">+ 新增課級</el-button>
        <el-table :data="sections" stripe size="small">
          <el-table-column label="部門" width="150">
            <template #default="{ row }">{{ row.department?.name }}</template>
          </el-table-column>
          <el-table-column prop="name" label="課級名稱" width="180" />
          <el-table-column label="人員">
            <template #default="{ row }">
              <span v-for="p in personsOf('section', row.id)" :key="p.id" class="person-tag">
                {{ p.name }}{{ p.title ? `（${p.title}）` : '' }}
              </span>
              <span v-if="personsOf('section', row.id).length === 0" class="no-person">未設定</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="openEditSection(row)">編輯</el-button>
              <el-button size="small" type="danger" @click="removeSection(row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 通用新增 Dialog -->
    <el-dialog v-model="showAdd" :title="addTitle" width="480px" destroy-on-close>
      <el-form :model="addForm" label-width="80px">
        <el-form-item v-if="addType === 'dept'" label="所屬本部">
          <el-select v-model="addForm.divisionId" clearable style="width:100%">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="addType === 'section'" label="所屬本部">
          <el-select v-model="addForm.divisionId" clearable style="width:100%" @change="addForm.departmentId = null">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="addType === 'section'" label="所屬部門">
          <el-select v-model="addForm.departmentId" clearable style="width:100%">
            <el-option v-for="d in filteredDepts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名稱">
          <el-input v-model="addForm.name" />
        </el-form-item>
      </el-form>

      <el-divider content-position="left" style="margin:14px 0 8px">人員名單</el-divider>
      <div
        v-for="(p, i) in addForm.persons"
        :key="i"
        class="person-row"
      >
        <el-input v-model="p.name" placeholder="姓名" size="small" style="flex:1" />
        <el-input v-model="p.title" placeholder="職稱" size="small" style="flex:1" />
        <el-button size="small" type="danger" @click="addForm.persons.splice(i, 1)">✕</el-button>
      </div>
      <el-button size="small" class="add-person-btn" @click="addForm.persons.push({ name: '', title: '' })">
        + 加入人員
      </el-button>

      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAdd">新增</el-button>
      </template>
    </el-dialog>

    <!-- 本部編輯 Dialog -->
    <el-dialog v-model="showEditDiv" title="編輯本部" width="480px" destroy-on-close>
      <el-form :model="editDivForm" label-width="80px">
        <el-form-item label="本部名稱">
          <el-input v-model="editDivForm.name" />
        </el-form-item>
      </el-form>
      <el-divider content-position="left" style="margin:14px 0 8px">人員名單</el-divider>
      <div v-for="(p, i) in editPersonsList" :key="i" class="person-row">
        <el-input v-model="p.name" placeholder="姓名" size="small" style="flex:1" />
        <el-input v-model="p.title" placeholder="職稱" size="small" style="flex:1" />
        <el-button size="small" type="danger" @click="removePersonInline(p, i)">✕</el-button>
      </div>
      <el-button size="small" class="add-person-btn" @click="editPersonsList.push({ id: null, name: '', title: '' })">
        + 加入人員
      </el-button>
      <template #footer>
        <el-button @click="showEditDiv = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditDiv">儲存</el-button>
      </template>
    </el-dialog>

    <!-- 部門編輯 Dialog -->
    <el-dialog v-model="showEditDept" title="編輯部門" width="480px" destroy-on-close>
      <el-form :model="editDeptForm" label-width="80px">
        <el-form-item label="所屬本部">
          <el-select v-model="editDeptForm.divisionId" clearable style="width:100%">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="部門名稱">
          <el-input v-model="editDeptForm.name" />
        </el-form-item>
      </el-form>
      <el-divider content-position="left" style="margin:14px 0 8px">人員名單</el-divider>
      <div v-for="(p, i) in editPersonsList" :key="i" class="person-row">
        <el-input v-model="p.name" placeholder="姓名" size="small" style="flex:1" />
        <el-input v-model="p.title" placeholder="職稱" size="small" style="flex:1" />
        <el-button size="small" type="danger" @click="removePersonInline(p, i)">✕</el-button>
      </div>
      <el-button size="small" class="add-person-btn" @click="editPersonsList.push({ id: null, name: '', title: '' })">
        + 加入人員
      </el-button>
      <template #footer>
        <el-button @click="showEditDept = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditDept">儲存</el-button>
      </template>
    </el-dialog>

    <!-- 課級編輯 Dialog -->
    <el-dialog v-model="showEditSection" title="編輯課級" width="480px" destroy-on-close>
      <el-form :model="editSectionForm" label-width="80px">
        <el-form-item label="所屬本部">
          <el-select v-model="editSectionForm.divisionId" clearable style="width:100%" @change="editSectionForm.departmentId = null">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所屬部門">
          <el-select v-model="editSectionForm.departmentId" clearable style="width:100%">
            <el-option v-for="d in editSectionDepts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="課級名稱">
          <el-input v-model="editSectionForm.name" />
        </el-form-item>
      </el-form>
      <el-divider content-position="left" style="margin:14px 0 8px">人員名單</el-divider>
      <div v-for="(p, i) in editPersonsList" :key="i" class="person-row">
        <el-input v-model="p.name" placeholder="姓名" size="small" style="flex:1" />
        <el-input v-model="p.title" placeholder="職稱" size="small" style="flex:1" />
        <el-button size="small" type="danger" @click="removePersonInline(p, i)">✕</el-button>
      </div>
      <el-button size="small" class="add-person-btn" @click="editPersonsList.push({ id: null, name: '', title: '' })">
        + 加入人員
      </el-button>
      <template #footer>
        <el-button @click="showEditSection = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEditSection">儲存</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { divisionsApi, departmentsApi, sectionsApi, deptPersonsApi } from '../../api/index.js'
import AppLayout from '../../components/AppLayout.vue'

// ── 資料 ─────────────────────────────────────────────────────
const divisions = ref([])
const departments = ref([])
const sections = ref([])
const showAdd = ref(false)
const saving = ref(false)
const addType = ref('')
const addForm = reactive({ name: '', divisionId: null, departmentId: null, persons: [] })

// 本部編輯
const showEditDiv = ref(false)
const editDivTarget = ref(null)
const editDivForm = reactive({ name: '' })

// 部門編輯
const showEditDept = ref(false)
const editDeptTarget = ref(null)
const editDeptForm = reactive({ name: '', divisionId: null })

// 課級編輯
const showEditSection = ref(false)
const editSectionTarget = ref(null)
const editSectionForm = reactive({ name: '', divisionId: null, departmentId: null })
const editSectionDepts = computed(() =>
  editSectionForm.divisionId
    ? departments.value.filter(d => d.divisionId === editSectionForm.divisionId)
    : departments.value
)

// 人員管理（共用）
const editPersonsList = ref([])
const allPersons = ref([])

function personsOf(type, id) {
  if (type === 'division')   return allPersons.value.filter(p => p.divisionId   === id)
  if (type === 'department') return allPersons.value.filter(p => p.departmentId === id)
  if (type === 'section')    return allPersons.value.filter(p => p.sectionId    === id)
  return []
}

const addTitle = computed(() =>
  ({ division: '新增本部', dept: '新增部門', section: '新增課級' })[addType.value]
)
const filteredDepts = computed(() =>
  addForm.divisionId ? departments.value.filter(d => d.divisionId === addForm.divisionId) : departments.value
)

onMounted(load)

async function load() {
  try {
    const [dRes, deptRes, secRes, pRes] = await Promise.all([
      divisionsApi.list(),
      departmentsApi.list(),
      sectionsApi.list(),
      deptPersonsApi.list(),
    ])
    divisions.value = dRes.data
    departments.value = deptRes.data
    sections.value = secRes.data
    allPersons.value = pRes.data
  } catch (e) {
    ElMessage.error('載入資料失敗，請確認後端服務已啟動')
  }
}

async function loadEditPersons(type, id) {
  if (!id) return
  editPersonsList.value = []
  const params = {}
  if (type === 'division')        params.divisionId   = id
  else if (type === 'department') params.departmentId = id
  else if (type === 'section')    params.sectionId    = id
  try {
    const res = await deptPersonsApi.list(params)
    editPersonsList.value = res.data.map(p => ({ ...p }))
  } catch (e) {
    ElMessage.error('載入人員失敗，請稍後再試')
  }
}

async function savePersonInline() {} // 已由統一儲存替代

async function removePersonInline(p, i) {
  // 尚未存入 DB（無 id）→ 直接從清單移除
  if (!p.id) {
    editPersonsList.value.splice(i, 1)
    return
  }
  try {
    await ElMessageBox.confirm(`確定刪除「${p.name}」？`, '確認', { type: 'warning' })
  } catch { return }
  try {
    await deptPersonsApi.remove(p.id)
    editPersonsList.value.splice(i, 1)
    allPersons.value = allPersons.value.filter(x => x.id !== p.id)
    ElMessage.success('已刪除')
  } catch (e) { ElMessage.error(e.response?.data?.error || '刪除失敗') }
}

// ── 新增 ──────────────────────────────────────────────────────
function openAdd(type) {
  addType.value = type
  Object.assign(addForm, { name: '', divisionId: null, departmentId: null, persons: [] })
  showAdd.value = true
}

async function saveAdd() {
  if (!addForm.name) return ElMessage.warning('請輸入名稱')
  saving.value = true
  try {
    let parentId
    if (addType.value === 'division') {
      const res = await divisionsApi.create({ name: addForm.name })
      parentId = res.data.id
    } else if (addType.value === 'dept') {
      const res = await departmentsApi.create({ name: addForm.name, divisionId: addForm.divisionId })
      parentId = res.data.id
    } else if (addType.value === 'section') {
      const res = await sectionsApi.create({ name: addForm.name, departmentId: addForm.departmentId })
      parentId = res.data.id
    }
    // 建立人員
    for (const p of addForm.persons) {
      if (!p.name) continue
      const data = { name: p.name, title: p.title || '' }
      if (addType.value === 'division')    data.divisionId   = parentId
      else if (addType.value === 'dept')   data.departmentId = parentId
      else if (addType.value === 'section') data.sectionId   = parentId
      await deptPersonsApi.create(data)
    }
    showAdd.value = false
    ElMessage.success('新增成功')
    await load()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '新增失敗')
  } finally { saving.value = false }
}

// ── 刪除 ──────────────────────────────────────────────────────
async function removeDiv(row) {
  try {
    await ElMessageBox.confirm(`確定刪除本部「${row.name}」？`, '確認', { type: 'warning' })
  } catch { return }
  try {
    await divisionsApi.remove(row.id)
    ElMessage.success('已刪除')
    load()
  } catch (e) { ElMessage.error(e.response?.data?.error || '刪除失敗') }
}
async function removeDept(row) {
  try {
    await ElMessageBox.confirm(`確定刪除部門「${row.name}」？`, '確認', { type: 'warning' })
  } catch { return }
  try {
    await departmentsApi.remove(row.id)
    ElMessage.success('已刪除')
    load()
  } catch (e) { ElMessage.error(e.response?.data?.error || '刪除失敗') }
}
async function removeSection(row) {
  try {
    await ElMessageBox.confirm(`確定刪除課級「${row.name}」？`, '確認', { type: 'warning' })
  } catch { return }
  try {
    await sectionsApi.remove(row.id)
    ElMessage.success('已刪除')
    load()
  } catch (e) { ElMessage.error(e.response?.data?.error || '刪除失敗') }
}

// ── 編輯 ──────────────────────────────────────────────────────
function openEditDiv(row) {
  editDivTarget.value = row
  Object.assign(editDivForm, { name: row.name })
  loadEditPersons('division', row.id)
  showEditDiv.value = true
}
async function saveEditDiv() {
  if (!editDivForm.name) return ElMessage.warning('請輸入本部名稱')
  saving.value = true
  try {
    const res = await divisionsApi.update(editDivTarget.value.id, { name: editDivForm.name })
    const idx = divisions.value.findIndex(d => d.id === editDivTarget.value.id)
    if (idx !== -1) divisions.value[idx].name = res.data.name
    for (const p of editPersonsList.value) {
      if (!p.id) {
        const data = { name: p.name, title: p.title, divisionId: editDivTarget.value.id }
        const res = await deptPersonsApi.create(data)
        allPersons.value.push(res.data)
      } else {
        await deptPersonsApi.update(p.id, { name: p.name, title: p.title })
        const ai = allPersons.value.findIndex(x => x.id === p.id)
        if (ai !== -1) { allPersons.value[ai].name = p.name; allPersons.value[ai].title = p.title }
      }
    }
    showEditDiv.value = false
    ElMessage.success('已儲存')
  } catch (e) { ElMessage.error(e.response?.data?.error || '儲存失敗') }
  finally { saving.value = false }
}

function openEditDept(row) {
  editDeptTarget.value = row
  Object.assign(editDeptForm, { name: row.name, divisionId: row.divisionId ?? row.division?.id ?? null })
  loadEditPersons('department', row.id)
  showEditDept.value = true
}
async function saveEditDept() {
  if (!editDeptForm.name) return ElMessage.warning('請輸入部門名稱')
  saving.value = true
  try {
    const res = await departmentsApi.update(editDeptTarget.value.id, {
      name: editDeptForm.name,
      divisionId: editDeptForm.divisionId,
    })
    const idx = departments.value.findIndex(d => d.id === editDeptTarget.value.id)
    if (idx !== -1) departments.value[idx] = res.data
    for (const p of editPersonsList.value) {
      if (!p.id) {
        const data = { name: p.name, title: p.title, departmentId: editDeptTarget.value.id }
        const res = await deptPersonsApi.create(data)
        allPersons.value.push(res.data)
      } else {
        await deptPersonsApi.update(p.id, { name: p.name, title: p.title })
        const ai = allPersons.value.findIndex(x => x.id === p.id)
        if (ai !== -1) { allPersons.value[ai].name = p.name; allPersons.value[ai].title = p.title }
      }
    }
    showEditDept.value = false
    ElMessage.success('已儲存')
  } catch (e) { ElMessage.error(e.response?.data?.error || '儲存失敗') }
  finally { saving.value = false }
}

function openEditSection(row) {
  editSectionTarget.value = row
  const dept = departments.value.find(d => d.id === row.departmentId)
  Object.assign(editSectionForm, {
    name: row.name,
    divisionId: dept?.divisionId ?? null,
    departmentId: row.departmentId ?? null,
  })
  loadEditPersons('section', row.id)
  showEditSection.value = true
}
async function saveEditSection() {
  if (!editSectionForm.name) return ElMessage.warning('請輸入課級名稱')
  saving.value = true
  try {
    const res = await sectionsApi.update(editSectionTarget.value.id, {
      name: editSectionForm.name,
      departmentId: editSectionForm.departmentId,
    })
    const idx2 = sections.value.findIndex(s => s.id === editSectionTarget.value.id)
    if (idx2 !== -1) sections.value[idx2] = res.data
    for (const p of editPersonsList.value) {
      if (!p.id) {
        const data = { name: p.name, title: p.title, sectionId: editSectionTarget.value.id }
        const res = await deptPersonsApi.create(data)
        allPersons.value.push(res.data)
      } else {
        await deptPersonsApi.update(p.id, { name: p.name, title: p.title })
        const ai = allPersons.value.findIndex(x => x.id === p.id)
        if (ai !== -1) { allPersons.value[ai].name = p.name; allPersons.value[ai].title = p.title }
      }
    }
    showEditSection.value = false
    ElMessage.success('已儲存')
  } catch (e) { ElMessage.error(e.response?.data?.error || '儲存失敗') }
  finally { saving.value = false }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
.add-btn { margin-bottom: 10px; }
.add-person-btn { margin-top: 4px; }
.person-tag {
  display: inline-block;
  margin: 2px 6px 2px 0;
  padding: 2px 10px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 20px;
  font-size: 12px;
  color: #0369a1;
  line-height: 1.5;
}
.no-person { color: #bbb; font-size: 12px; }
.person-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  align-items: center;
}
</style>
