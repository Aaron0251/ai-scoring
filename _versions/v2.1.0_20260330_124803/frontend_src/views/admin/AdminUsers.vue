<template>
  <AppLayout>
    <h2 class="page-title">使用者管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="openCreate">+ 新增使用者</el-button>

    <el-table :data="users" stripe v-loading="loading" size="small">
      <el-table-column prop="username" label="帳號" width="120" />
      <el-table-column prop="name" label="姓名" width="110" />
      <el-table-column label="角色" width="180">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r" size="small" style="margin-right:4px">{{ roleLabel(r) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="部門" width="130">
        <template #default="{ row }">{{ row.department?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="狀態" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '啟用' : '停用' }}</el-tag>
          <br />
          <el-button
            size="small"
            :type="row.active ? 'warning' : 'success'"
            style="margin-top:4px"
            @click="toggleActive(row)"
          >{{ row.active ? '停用' : '啟用' }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">編輯</el-button>
          <el-button size="small" @click="openResetPw(row)">重設密碼</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/編輯對話框 -->
    <el-dialog v-model="showDialog" :title="editingUser ? '編輯使用者' : '新增使用者'" width="500px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="帳號" v-if="!editingUser">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="初始密碼" v-if="!editingUser">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="角色">
          <el-checkbox-group v-model="form.roles">
            <el-checkbox v-for="r in roleOptions" :key="r" :value="r">{{ roleLabel(r) }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="部門">
          <el-select v-model="form.departmentId" clearable placeholder="選擇部門">
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">儲存</el-button>
      </template>
    </el-dialog>

    <!-- 重設密碼 -->
    <el-dialog v-model="showResetPw" title="重設密碼" width="380px">
      <el-input v-model="newPassword" type="password" show-password placeholder="輸入新密碼（至少 6 字元）" />
      <template #footer>
        <el-button @click="showResetPw = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleResetPw">確認重設</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { usersApi, departmentsApi } from '../../api/index.js'
import AppLayout from '../../components/AppLayout.vue'

const users = ref([])
const departments = ref([])
const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const showResetPw = ref(false)
const editingUser = ref(null)
const resetTarget = ref(null)
const newPassword = ref('')
const roleOptions = ['admin', 'manager', 'evaluator', 'chief', 'executive', 'user']
const roleMap = {
  admin:     '系統管理員',
  manager:   '種子負責人',
  evaluator: '評分者',
  chief:     '直屬主管',
  executive: '高階主管',
  user:      '一般使用者',
}
function roleLabel(r) { return roleMap[r] || r }
const form = reactive({ username: '', password: '', name: '', roles: [], departmentId: null })

onMounted(async () => {
  loading.value = true
  try {
    const [uRes, dRes] = await Promise.all([usersApi.list(), departmentsApi.list()])
    users.value = uRes.data
    departments.value = dRes.data
  } finally { loading.value = false }
})

function openCreate() {
  editingUser.value = null
  Object.assign(form, { username: '', password: '', name: '', roles: ['user'], departmentId: null })
  showDialog.value = true
}

function openEdit(user) {
  editingUser.value = user
  Object.assign(form, { name: user.name, roles: [...user.roles], departmentId: user.departmentId })
  showDialog.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (editingUser.value) {
      const res = await usersApi.update(editingUser.value.id, { name: form.name, roles: form.roles, departmentId: form.departmentId })
      Object.assign(editingUser.value, res.data)
    } else {
      const res = await usersApi.create(form)
      users.value.push(res.data)
    }
    showDialog.value = false
    ElMessage.success('儲存成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '儲存失敗')
  } finally { saving.value = false }
}

function openResetPw(user) { resetTarget.value = user; newPassword.value = ''; showResetPw.value = true }

async function handleResetPw() {
  if (!newPassword.value || newPassword.value.length < 6) return ElMessage.warning('密碼至少 6 字元')
  saving.value = true
  try {
    await usersApi.resetPassword(resetTarget.value.id, { newPassword: newPassword.value })
    ElMessage.success('密碼已重設，使用者下次登入需變更密碼')
    showResetPw.value = false
  } finally { saving.value = false }
}

async function toggleActive(user) {
  await usersApi.update(user.id, { active: !user.active })
  user.active = !user.active
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
