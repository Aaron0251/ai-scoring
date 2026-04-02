<template>
  <div class="login-page">
    <div class="login-box">
      <!-- Logo / 標題區 -->
      <div class="login-header">
        <div class="login-logo">
          <el-icon size="36" color="#6366f1"><DataAnalysis /></el-icon>
        </div>
        <h1>AI 推動管理系統</h1>
        <p>請登入以繼續使用</p>
      </div>

      <!-- 表單區 -->
      <div class="login-form">
        <div class="form-item">
          <label>帳號</label>
          <el-input
            v-model="form.username"
            placeholder="請輸入帳號"
            size="large"
            autofocus
            @keyup.enter="handleLogin"
          >
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </div>

        <div class="form-item">
          <label>密碼</label>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="請輸入密碼"
            size="large"
            @keyup.enter="handleLogin"
          >
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </div>

        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <el-button
          type="primary"
          :loading="loading"
          size="large"
          class="login-btn"
          @click="handleLogin"
        >
          登入
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
const errorMsg = ref('')
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { FEATURES } from '../constants/features.js'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

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
    if (route.query.redirect) {
      router.push(route.query.redirect)
    } else {
      const first = FEATURES.find(f => f.path && auth.hasFeature(f.key))
      router.push(first ? first.path : '/no-access')
    }
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
  background: linear-gradient(135deg, #e0e7ff 0%, #f0f2f5 60%, #ede9fe 100%);
  padding: 16px;
}

.login-box {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.12);
  padding: 40px 32px 36px;
}

/* 手機版縮小內距 */
@media (max-width: 480px) {
  .login-box {
    padding: 32px 20px 28px;
    border-radius: 12px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: #eef2ff;
  border-radius: 16px;
  margin-bottom: 16px;
}

.login-header h1 {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
}

@media (max-width: 480px) {
  .login-header h1 {
    font-size: 18px;
  }
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: #94a3b8;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.error-msg {
  color: #f56c6c;
  font-size: 13px;
  margin-top: -6px;
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  margin-top: 4px;
}
</style>

