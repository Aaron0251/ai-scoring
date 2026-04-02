<template>
  <div class="login-page">
    <div class="login-box">
      <div class="login-box-inner">
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
      </div><!-- login-box-inner -->
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
  min-height: 100dvh; /* 支援動態高度（iOS Safari 網址列） */
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e7ff 0%, #f0f2f5 55%, #ede9fe 100%);
  padding: 16px;
  padding-top: max(16px, env(safe-area-inset-top));
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}

.login-box {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.14), 0 2px 8px rgba(0,0,0,0.06);
  overflow: hidden; /* 讓頂部色條有圓角 */
}

/* 頂部品牌色條 */
.login-box::before {
  content: '';
  display: block;
  height: 4px;
  background: linear-gradient(90deg, #6366f1, #818cf8, #a5b4fc);
}

.login-box-inner {
  padding: 36px 32px 32px;
}

@media (max-width: 480px) {
  .login-box {
    border-radius: 16px;
  }
  .login-box-inner {
    padding: 28px 20px 24px;
  }
}

@media (max-width: 360px) {
  .login-box-inner {
    padding: 24px 16px 20px;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.login-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  border-radius: 18px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.18);
}

.login-header h1 {
  margin: 0 0 6px;
  font-size: 21px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: 0.3px;
}

.login-header p {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

@media (max-width: 480px) {
  .login-header h1 { font-size: 18px; }
  .login-logo { width: 60px; height: 60px; border-radius: 14px; }
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  background: #fff2f2;
  border: 1px solid #fcc;
  border-radius: 8px;
  color: #e53e3e;
  font-size: 13px;
  padding: 8px 12px;
  margin-top: -4px;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border: none;
  margin-top: 4px;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
  transition: opacity 0.2s, box-shadow 0.2s;
}
.login-btn:hover {
  opacity: 0.92;
  box-shadow: 0 6px 18px rgba(99, 102, 241, 0.4);
}
.login-btn:active {
  opacity: 0.85;
}

@media (max-width: 480px) {
  .login-btn { height: 44px; font-size: 14px; }
}
</style>

