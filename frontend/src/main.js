import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import './assets/responsive.css'
import { useAuthStore } from './stores/auth.js'

const app = createApp(App)

// Element Plus Icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhTw })

app.mount('#app')

// 啟動時若已登入，立刻從後端刷新 user 資料（確保 allowedFeatures 是最新的）
const auth = useAuthStore()
if (auth.isLoggedIn) {
  auth.fetchMe().catch(() => {
    // token 過期或失效 → 清除登入狀態
    auth.logout()
    router.push({ name: 'login' })
  })
}
