# GCP 部署指南

## 前置資訊

- GCP 專案編號：1025724622354
- 建議區域：asia-east1（台灣）

---

## STEP 1：安裝 gcloud CLI

前往以下網址下載 Windows 安裝程式：
https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe

安裝完成後，**重新開啟 PowerShell 或終端機**，然後執行：

```powershell
gcloud --version
```

---

## STEP 2：安裝 Firebase CLI

```powershell
npm install -g firebase-tools
```

---

## STEP 3：登入並設定專案

```powershell
# 登入 Google 帳號
gcloud auth login

# 確認並設定專案（用專案 ID，不是編號）
# 先查詢你的專案 ID：
gcloud projects list

# 設定預設專案（將 YOUR_PROJECT_ID 換成查到的 ID）
gcloud config set project YOUR_PROJECT_ID

# Firebase 登入
firebase login
```

---

## STEP 4：啟用必要 GCP API

```powershell
gcloud services enable `
  run.googleapis.com `
  sqladmin.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com
```

---

## STEP 5：建立 Cloud SQL PostgreSQL 資料庫

```powershell
# 建立 PostgreSQL 15 實例（約需 5-10 分鐘）
gcloud sql instances create ai-scoring-db `
  --database-version=POSTGRES_15 `
  --tier=db-f1-micro `
  --region=asia-east1 `
  --root-password=YOUR_DB_PASSWORD

# 建立資料庫
gcloud sql databases create ai_scoring --instance=ai-scoring-db

# 取得連線名稱（格式：PROJECT_ID:asia-east1:ai-scoring-db）
gcloud sql instances describe ai-scoring-db --format="value(connectionName)"
```

記下 **connectionName**，後續會用到。

---

## STEP 6：執行資料庫 Migration

```powershell
# 安裝 Cloud SQL Auth Proxy（Windows）
# 下載：https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.x64.exe
# 重新命名為 cloud-sql-proxy.exe 放在 backend 資料夾

# 在新的終端機視窗執行 Proxy（替換 PROJECT_ID）
cloud-sql-proxy.exe PROJECT_ID:asia-east1:ai-scoring-db --port 5432

# 在 backend 目錄執行 migration
cd backend
$env:DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@127.0.0.1:5432/ai_scoring"
$env:DIRECT_URL="postgresql://postgres:YOUR_DB_PASSWORD@127.0.0.1:5432/ai_scoring"
npx prisma migrate deploy
```

---

## STEP 7：部署後端到 Cloud Run

```powershell
cd backend

# 替換以下變數：
# - PROJECT_ID：你的 GCP 專案 ID
# - YOUR_DB_PASSWORD：資料庫密碼
# - YOUR_JWT_SECRET：任意 32 字元以上的隨機字串
# - CONNECTION_NAME：STEP 5 取得的 connectionName

gcloud run deploy ai-scoring-backend `
  --source . `
  --region asia-east1 `
  --platform managed `
  --allow-unauthenticated `
  --add-cloudsql-instances CONNECTION_NAME `
  --set-env-vars NODE_ENV=production `
  --set-env-vars JWT_SECRET=YOUR_JWT_SECRET `
  --set-env-vars DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost/ai_scoring?host=/cloudsql/CONNECTION_NAME" `
  --set-env-vars DIRECT_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost/ai_scoring?host=/cloudsql/CONNECTION_NAME" `
  --set-env-vars FRONTEND_URL=https://YOUR_PROJECT_ID.web.app
```

部署完成後取得後端網址，格式類似：
`https://ai-scoring-backend-xxxxxxxxxx-de.a.run.app`

---

## STEP 8：部署前端到 Firebase Hosting

```powershell
cd ..\frontend

# 更新 .env.production（將後端網址填入）
# 編輯 frontend\.env.production，內容改為：
# VITE_API_BASE_URL=https://ai-scoring-backend-xxxxxxxxxx-de.a.run.app/api

# 建置前端
npm run build

# 初始化 Firebase（只需第一次）
firebase init hosting
# 選擇：Use an existing project → 選你的 GCP 專案
# public directory：dist
# SPA：Yes
# 不要覆蓋 dist/index.html

# 部署
firebase deploy --only hosting
```

部署完成後取得前端網址，格式類似：
`https://YOUR_PROJECT_ID.web.app`

---

## STEP 9：更新 Cloud Run CORS 設定

取得前端網址後，更新後端的 FRONTEND_URL：

```powershell
gcloud run services update ai-scoring-backend `
  --region asia-east1 `
  --set-env-vars FRONTEND_URL=https://YOUR_PROJECT_ID.web.app
```

---

## 費用估算（月）

| 服務 | 費用 |
|------|------|
| Firebase Hosting | 免費 |
| Cloud Run（低流量） | 免費（每月 200萬請求免費） |
| Cloud SQL db-f1-micro | ~$7-10 USD |
| 合計 | ~$7-10 USD/月 |

---

## 常用維護指令

```powershell
# 查看後端 logs
gcloud run services logs read ai-scoring-backend --region asia-east1

# 更新後端程式（重新部署）
cd backend
gcloud run deploy ai-scoring-backend --source . --region asia-east1

# 更新前端
cd frontend
npm run build
firebase deploy --only hosting
```
