<template>
  <div class="login-page">
    <el-card class="login-card">
      <template #header>
        <div class="card-header">
          <h2>AI 推動管理系統</h2>
          <p>請登入以繼續</p>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        label-position="top"
        @keyup.enter="handleLogin"
      >
        <el-form-item label="帳號">
          <el-input v-model="form.username" placeholder="請輸入帳號" autofocus />
        </el-form-item>

        <el-form-item label="密碼">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="請輸入密碼"
          />
        </el-form-item>

        <div v-if="errorMsg" style="color: #f56c6c; font-size: 13px; margin: -8px 0 12px 0;">{{ errorMsg }}</div>

        <el-button
          type="primary"
          :loading="loading"
          style="width: 100%"
          @click="handleLogin"
        >
          登入
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
const errorMsg = ref('')
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth.js'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function handleLogin() {
  errorMsg.value = ''
  if (!form.username) { errorMsg.value = '請輸入帳號'; return }
  if (!form.password) { errorMsg.value = '請輸入密碼'; return }
  loading.value = true
  sessionStorage.clear()
  localStorage.clear()
  try {
    await auth.login(form.username, form.password)
    const redirect = route.query.redirect || '/dashboard'
    router.push(redirect)
  } catch (err) {
    errorMsg.value = err.response?.data?.error || err.message || '登入失敗，請檢查帳號和密碼'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f2f5;
}
.login-card {
  width: 400px;
}
.card-header {
  text-align: center;
}
.card-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.card-header p {
  margin: 0;
  color: #888;
  font-size: 14px;
}
</style>
