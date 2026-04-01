---
name: ai-scoring
description: '專案知識 skill for ai-scoring 系統。Use when: 開發新功能、修改 API、新增前端頁面、部署、調整權限邏輯、新增路由、修改資料模型。包含：技術棧、角色定義、API 清單、檔案結構慣例、部署流程。'
argument-hint: '描述要做什麼，例如：新增一個 XXX 功能頁面'
---

# AI 推動管理系統 — 專案知識

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | Vue 3 (Composition API) + Vite + Element Plus + Pinia + Vue Router |
| 後端 | Node.js + Express 5 + Prisma 7 (PostgreSQL) |
| 部署 | 後端 → Railway，前端 → Vercel |
| 本機開發 | PostgreSQL via Docker Compose，前端 port 5174，後端 port 3001 |

## 角色定義

```js
// frontend/src/constants/roles.js
ROLES = {
  ADMIN:     'admin',      // 系統管理員 — 全部功能
  MANAGER:   'manager',    // 種子負責人 — 限本部
  CHIEF:     'chief',      // 主管       — 全公司（可見）
  EXECUTIVE: 'executive',  // 公司管理層 — 全公司（可見）
}
// 其他角色：boss（特殊），evaluator（唯讀）
```

**資料可見範圍規則：**
- `admin / executive / chief` → 全公司所有資料
- `manager` → 只能看自己 `divisionId` 所屬本部
- 場景存取入口：`canAccessScene()` in `sceneController.js`

## 組織架構（三層）

```
Division（本部）→ Department（部門）→ Section（課別）
User 可掛在任何一層（divisionId / departmentId / sectionId）
```

## 資料庫模型（重要欄位）

### Scene（核心）
- `itemNo` — 自動編號（AI-0001）
- `status` — 規劃中 / 進行中 / 已完成 / 暫停
- `progress` — 0-100
- `departmentId` — 必填（決定所屬本部）
- `seedOwners` — 種子負責人（逗號分隔文字）
- `taskOwners` — 任務負責人
- `originalHours / improvedHours` — 原/改善後時數
- `originalHeadcount / improvedHeadcount` — 原/改善後人數

### 關聯
- `SceneExecutionLog` — 執行日誌（logDate, executor, content, status, note）
- `SceneActualSavings` — 實際節省時數（年月別，jan~dec）

## 後端 API 清單

| 路徑 | 說明 |
|------|------|
| `POST /api/auth/login` | 登入，回傳 JWT |
| `GET /api/auth/me` | 取得當前使用者 |
| `GET /api/divisions` | 本部列表 |
| `GET /api/departments` | 部門列表 |
| `GET /api/sections` | 課別列表 |
| `GET /api/dept-persons` | 主管名單 |
| `GET /api/users` | 使用者列表（admin only） |
| `GET /api/scenes` | 場景列表（依角色過濾） |
| `GET /api/scenes/:id` | 場景詳情 |
| `POST /api/scenes` | 新增場景 |
| `PUT /api/scenes/:id` | 更新場景 |
| `GET /api/scenes/:sceneId/execution-logs` | 執行日誌 |
| `POST /api/scenes/:sceneId/execution-logs` | 新增日誌 |
| `GET /api/scenes/:sceneId/actual-savings` | 實際節省時數 |
| `PUT /api/scenes/:sceneId/actual-savings/:year` | 更新節省時數 |
| `GET /api/dashboard` | 儀表板統計 |
| `GET /api/efficiency-reports` | 效率報表 |
| `GET /api/leader-tracking` | 種子負責人概覽 |
| `GET /api/leader-tracking/:userId/scenes` | 特定負責人場景 |
| `POST /api/import/excel` | Excel 批次匯入 |
| `GET /api/config` | 系統設定 |

## 後端開發慣例

### 路由檔案結構
```js
const express = require('express');
const { authenticate, authorize, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/yourController');
const router = express.Router();

router.get('/', authenticate, ctrl.getAll);
router.post('/', authenticate, requireAdmin, ctrl.create);
// ...
module.exports = router;
```

### Middleware 匯入方式（具名匯出）
```js
// ✅ 正確
const { authenticate } = require('../middleware/auth');
// ❌ 錯誤（會導致 TypeError: argument handler is required）
const auth = require('../middleware/auth');
router.use(auth);
```

### 新增後端路由步驟

1. 建立 `src/controllers/xxxController.js`
2. 建立 `src/routes/xxx.js`（記得用具名匯出的 `{ authenticate }`）
3. 在 `src/index.js` 引入並掛載：
   ```js
   const xxxRoutes = require('./routes/xxx');
   app.use('/api/xxx', xxxRoutes);
   ```

## 前端開發慣例

### 頁面元件位置
```
frontend/src/views/          — 頁面
frontend/src/components/     — 共用元件（AppLayout.vue 必包）
frontend/src/stores/auth.js  — Pinia 認證 store
frontend/src/api/index.js    — Axios API 封裝
frontend/src/constants/roles.js — 角色常數
```

### 所有頁面必須用 AppLayout 包裹
```vue
<template>
  <AppLayout>
    <!-- 頁面內容 -->
  </AppLayout>
</template>
```

### Auth Store 可用屬性
```js
auth.isAdmin      // 系統管理員
auth.isManager    // 種子負責人
auth.isChief      // 主管
auth.isExecutive  // 公司管理層
auth.isBoss       // 上層管理
auth.hasRole('xxx') // 通用角色判斷
auth.user         // { id, name, roles, divisionId, departmentId, ... }
```

### Element Plus Icons 全域注冊
無需 import，直接在模板使用：
```vue
<el-icon><UserFilled /></el-icon>
```

### 新增前端路由步驟

1. 建立 `frontend/src/views/XxxView.vue`（用 `<AppLayout>` 包裹）
2. 在 `frontend/src/router/index.js` 新增路由：
   ```js
   {
     path: '/xxx',
     name: 'xxx',
     component: () => import('../views/XxxView.vue'),
     meta: { roles: ['admin', 'manager', ...] },
   }
   ```
3. 若需側邊選單，在 `frontend/src/components/AppLayout.vue` 新增 `<el-menu-item>`

### API 呼叫方式
```js
import api from '../api/index.js'

// 在 onMounted / 方法中
const { data } = await api.get('/leader-tracking')
const { data } = await api.post('/scenes', payload)
```

## 部署流程

```bash
# 1. 確認所有變更
git add -A
git commit -m "feat: xxx"
git push origin master
# → Railway（後端）和 Vercel（前端）自動部署
```

**後端環境變數（Railway）：**
- `DATABASE_URL` — PostgreSQL 連線字串
- `JWT_SECRET` — JWT 簽名金鑰
- `FRONTEND_URL` — 允許 CORS 的前端 URL

**前端環境變數（Vercel）：**
- `VITE_API_BASE_URL` — Railway 後端 URL（如 `https://xxx.railway.app`）

## 本機啟動

```powershell
# 方法一：雙擊 啟動系統.bat

# 方法二：手動
# 後端
cd backend; npm run dev
# 前端（另開終端）
cd frontend; npm run dev
# → http://localhost:5174
```

## 常見錯誤記錄

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `TypeError: argument handler is required` | `router.use(require('../middleware/auth'))` 缺少具名解構 | 改為 `const { authenticate } = require('../middleware/auth')` |
| 前端 API 404 | 路由未掛載到 `index.js` | 確認 `app.use('/api/xxx', xxxRoutes)` |
| Vercel 重新整理 404 | SPA 路由問題 | `vercel.json` 已設定 rewrites，確認存在 |
