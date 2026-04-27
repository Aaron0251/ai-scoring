# AI Agent 場景管理系統 V2

> 針對各部門 AI Agent 任務場景進行盤點、追蹤進度、記錄成效，並提供評核與儀表板監控。

---

## 技術架構

| 層次 | 技術 |
|------|------|
| 前端框架 | Vue 3 + Vite |
| UI 元件庫 | Element Plus |
| 圖表 | ECharts + vue-echarts |
| 後端框架 | Express 5 |
| ORM | Prisma 5 |
| 資料庫 | PostgreSQL |
| 認證 | JWT + bcryptjs |
| Excel | SheetJS (xlsx) |

---

## 快速啟動

### 前置需求

- [Node.js](https://nodejs.org/) v18 以上
- [PostgreSQL](https://www.postgresql.org/) 資料庫（或使用 Docker）

### 設定環境變數

在 `backend/` 目錄下建立 `.env` 檔案：

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ai_scoring"
JWT_SECRET="your-secret-key-at-least-32-characters"
PORT=3001
NODE_ENV=development
```

### 一鍵啟動（Windows）

```bat
啟動系統.bat
```

腳本會自動：
1. 安裝前後端相依套件（首次執行）
2. 啟動後端伺服器（Port 3001）
3. 啟動前端開發伺服器（Port 5173／5174）
4. 自動開啟瀏覽器

### 手動啟動

```bash
# 後端
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
node src/seed.js       # 建立初始資料（帳號 + 組織）
node src/index.js

# 前端（另開終端）
cd frontend
npm install
npm run dev
```

---

## 預設帳號

> 首次登入後系統會強制要求修改密碼。

| 帳號 | 密碼 | 角色 |
|------|------|------|
| `admin` | `admin1234` | 系統管理員 |
| `manager1` | `manager1` | 任務管理 |
| `evaluator1` | `evaluator1` | 評核管理 |
| `chief1` | `chief1` | 主管 |
| `executive1` | `executive1` | 公司管理層 |
| `user1` | `user1` | 多重角色示範（manager + evaluator + chief）|

---

## 角色說明

| 角色 | 名稱 | 核心權限 |
|------|------|----------|
| `admin` | 系統管理員 | 管理所有功能，含組織、帳號、場景、評核、設定、權限 |
| `manager` | 任務管理 | 管理被指派部門的場景（新增/編輯/匯入/進度/成效）|
| `evaluator` | 評核管理 | 評核指派部門的教官與直屬主管，查看評核報表 |
| `chief` | 主管 | 依指派層級查看/管理所屬範圍場景，跨本部全面隔離 |
| `executive` | 公司管理層 | 全公司唯讀查看，不得新增/編輯/刪除任何資料 |

> 一個帳號可同時擁有多重角色，登入後介面展示所有已授權功能模組。

---

## 主要功能

### 🏢 組織管理（Admin）
- 三層組織架構：本部 → 部門 → 課別
- 樹狀圖展示 + 節點搜尋
- 各層主管名單（本部/部門/課別）CRUD

### 📋 場景管理
- 場景 CRUD（34 個欄位，4 分頁 Drawer 表單）
- 篩選：本部 / 部門 / 課別 / 狀態 / 優先序 / 關鍵字
- 快速更新進度與狀態
- 跨部門效益記錄（SceneBenefit）
- 狀態改「已完成」自動寫入完成日

### 📥 Excel 匯入
- 上傳 xlsx，依欄位標題名稱自動對應 19 個欄位
- 支援「防重複新增」與「更新」兩種模式
- 匯入結果報告（成功 / 更新 / 跳過 / 錯誤）
- 下載標準範本

### 📊 儀表板
- 年度目標追蹤（節省時數 / 場景數環形圖）
- 階層式下鑽：全公司 → 本部 → 部門 → 課別
- 推動執行狀態三層展開表
- 各本部節省時數長條圖 / 狀態分布圓餅圖

### 📝 評核模組
- 週期管理（開放/關閉）
- 評核項目：教官組 / 直屬主管組
- 評分員逐指標評分 + 提交
- 歷週評分趨勢報表

### 🎯 推動效率評分系統
- 週評 / 月評兩種模式
- 系統依場景資料自動預填分數（7 項可量化指標）
- 人員層級分析（taskOwners / seedOwners 字串群組化）
- 推動遲滯偵測（週進度停滯 / 逾期風險）
- 全自動評分模式（`auto_score_mode=auto`）

### 👑 主管模組（chief）
- 本部/部門/課別 三層分別管轄，跨本部全面隔離
- 新增場景、更新進度、管理負責人

### 🏢 公司管理層（executive）
- 全公司場景、儀表板、評核結果唯讀查看
- API 層強制拒絕所有寫入請求

---

## 專案結構

```
ai-scoring-main/
├── 啟動系統.bat          ← Windows 一鍵啟動腳本
├── backend/              ← Express 5 + Prisma 後端
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.js      ← 伺服器入口（Port 3001）
│       ├── seed.js       ← 初始資料
│       ├── middleware/
│       └── routes/       ← 20 個 API 路由模組
├── frontend/             ← Vue 3 + Vite 前端
│   └── src/
│       ├── views/        ← admin / manager / evaluator / chief / executive
│       ├── stores/
│       ├── router/
│       └── api/
├── scripts/
│   └── backup.js         ← 版本快照腳本
└── _versions/            ← 歷史版本快照（自動管理）
```

---

## API 概覽

後端提供 20 個路由模組，統一前綴 `/api`：

| 路由模組 | 說明 |
|---------|------|
| `/api/auth` | 登入 / 取得使用者資訊 / 修改密碼 |
| `/api/divisions` | 本部 CRUD |
| `/api/departments` | 部門 CRUD |
| `/api/sections` | 課別 CRUD |
| `/api/dept-persons` | 部門主管名單 CRUD |
| `/api/users` | 帳號管理 + 角色/部門/主管節點指派 |
| `/api/scenes` | 場景 CRUD + 跨部門效益 |
| `/api/import` | Excel 匯入 + 範本下載 |
| `/api/config` | 系統設定（年度目標） |
| `/api/dashboard` | 儀表板統計 + 階層下鑽 |
| `/api/periods` | 評核週期管理 |
| `/api/criteria` | 評核項目管理 |
| `/api/person-scores` | 評分記錄 + 報表 |
| `/api/chief` | 主管場景存取 |
| `/api/permissions` | 角色功能授權矩陣 |
| `/api/efficiency-periods` | 推動效率評估週期 |
| `/api/efficiency-criteria` | 推動效率評分項目 |
| `/api/efficiency-evaluations` | 推動效率評估作業 |
| `/api/efficiency-reports` | 推動成效報表 + 遲滯偵測 |
| `/api/executive` | 公司管理層唯讀 API |

---

## 版本控制

每次改版前執行版本快照腳本，保留最近 10 份歷史版本：

```bash
cd backend
npm run backup -- 2.1.0
```

快照儲存於 `_versions/v{版本}_{日期時間}/`，包含 `backend/`、`frontend_src/`、`CHANGELOG.md`。

---

## 資安設計

- **存取控制**：所有 API 經 JWT 驗證 + 部門層級授權，後端不信任前端傳入 ID
- **密碼安全**：bcrypt（salt: 12）雜湊，永不儲存明文
- **注入防護**：全面使用 Prisma ORM 參數化查詢
- **防暴力破解**：同一 IP 5 次登入失敗後鎖定 15 分鐘
- **HTTP 安全標頭**：Helmet.js（HSTS / CSP / X-Frame-Options）
- **檔案上傳限制**：Excel ≤ 10MB，單次匯入上限 1,000 筆
- **輸入驗證**：所有 POST/PUT 路由使用 schema 驗證（Joi/Zod）

---

## 相關文件

| 文件 | 說明 |
|------|------|
| [PLAN.md](PLAN.md) | 系統完整技術規格（資料模型、API 路由、實作階段）|
| [FEATURES.md](FEATURES.md) | 功能說明（以使用者操作視角撰寫）|
