<template>
  <AppLayout>
    <h2 class="page-title">個人設定</h2>

    <el-card style="max-width: 480px">
      <template #header>變更密碼</template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="舊密碼" prop="oldPassword">
          <el-input v-model="form.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密碼" prop="newPassword">
          <el-input v-model="form.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="確認密碼" prop="confirm">
          <el-input v-model="form.confirm" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">變更密碼</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="max-width: 480px; margin-top: 16px">
      <template #header>我的帳號資訊</template>
      <el-descriptions :column="1">
        <el-descriptions-item label="帳號">{{ auth.user?.username }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ auth.user?.name }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag v-for="r in auth.user?.roles" :key="r" style="margin-right:4px">{{ roleLabel(r) }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </AppLayout>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { authApi } from '../api/index.js'
import { useAuthStore } from '../stores/auth.js'
import AppLayout from '../components/AppLayout.vue'

const roleMap = {
  admin:     '系統管理員',
  manager:   '種子負責人',
  evaluator: '評分者',
  chief:     '直屬主管',
  executive: '高階主管',
  user:      '一般使用者',
}
function roleLabel(r) { return roleMap[r] || r }

const auth = useAuthStore()
const formRef = ref()
const loading = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' })

const rules = {
  oldPassword: [{ required: true, message: '請輸入舊密碼', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '請輸入新密碼', trigger: 'blur' },
    { min: 6, message: '密碼至少 6 個字元', trigger: 'blur' },
  ],
  confirm: [
    { required: true, message: '請再次輸入密碼', trigger: 'blur' },
    {
      validator(rule, val, cb) {
        if (val !== form.newPassword) cb(new Error('兩次密碼不一致'))
        else cb()
      },
      trigger: 'blur',
    },
  ],
}

async function handleSubmit() {
  await formRef.value.validate()
  loading.value = true
  try {
    await authApi.changePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword })
    ElMessage.success('密碼變更成功')
    form.oldPassword = ''
    form.newPassword = ''
    form.confirm = ''
    // 重新取得最新使用者資訊
    await auth.fetchMe()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '密碼變更失敗')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
