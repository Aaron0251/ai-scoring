#!/bin/bash
# ============================================================
# AI 推動評分系統 - GCP Cloud Shell 一鍵部署腳本
# 在 Google Cloud Shell 執行此腳本
# ============================================================

set -e

# ── 請修改以下變數 ────────────────────────────────────────
PROJECT_ID=$(gcloud config get-value project)   # 自動取得目前專案 ID
REGION="asia-east1"                              # 台灣區域
DB_INSTANCE="ai-scoring-db"
DB_NAME="ai_scoring"
DB_PASSWORD="AiScoring2026!"                     # ⚠️ 請改成你自己的密碼
JWT_SECRET="ai-scoring-jwt-secret-key-2026-fme" # ⚠️ 請改成隨機字串
# ──────────────────────────────────────────────────────────

echo "================================================"
echo "  AI 推動評分系統 GCP 部署"
echo "  專案 ID：$PROJECT_ID"
echo "  區域：$REGION"
echo "================================================"

# Step 1：啟用必要 API
echo ""
echo "▶ Step 1：啟用 GCP API..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet

echo "✓ API 啟用完成"

# Step 2：建立 Cloud SQL 實例
echo ""
echo "▶ Step 2：建立 Cloud SQL PostgreSQL 實例（約需 5 分鐘）..."
if gcloud sql instances describe $DB_INSTANCE --quiet 2>/dev/null; then
  echo "✓ Cloud SQL 實例已存在，跳過建立"
else
  gcloud sql instances create $DB_INSTANCE \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password=$DB_PASSWORD \
    --quiet
  echo "✓ Cloud SQL 實例建立完成"
fi

# Step 3：建立資料庫
echo ""
echo "▶ Step 3：建立資料庫..."
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE --quiet 2>/dev/null || echo "✓ 資料庫已存在"

# 取得 Connection Name
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
echo "✓ Cloud SQL 連線名稱：$CONNECTION_NAME"

# Step 4：執行資料庫 Migration（透過 Cloud SQL Auth Proxy）
echo ""
echo "▶ Step 4：執行資料庫 Migration..."
cd ~/ai-scoring/backend

# 安裝 Cloud SQL Auth Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# 背景執行 Proxy
./cloud-sql-proxy $CONNECTION_NAME --port 5434 &
PROXY_PID=$!
sleep 5

# 執行 Migration
DATABASE_URL="postgresql://postgres:$DB_PASSWORD@127.0.0.1:5434/$DB_NAME" \
DIRECT_URL="postgresql://postgres:$DB_PASSWORD@127.0.0.1:5434/$DB_NAME" \
npx prisma migrate deploy

# 停止 Proxy
kill $PROXY_PID 2>/dev/null || true
echo "✓ 資料庫 Migration 完成"

# Step 5：部署後端到 Cloud Run
echo ""
echo "▶ Step 5：部署後端到 Cloud Run（約需 3-5 分鐘）..."
cd ~/ai-scoring/backend

DB_URL="postgresql://postgres:$DB_PASSWORD@localhost/$DB_NAME?host=/cloudsql/$CONNECTION_NAME"

gcloud run deploy ai-scoring-backend \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances $CONNECTION_NAME \
  --set-env-vars NODE_ENV=production \
  --set-env-vars JWT_SECRET=$JWT_SECRET \
  --set-env-vars DATABASE_URL="$DB_URL" \
  --set-env-vars DIRECT_URL="$DB_URL" \
  --set-env-vars FRONTEND_URL="https://$PROJECT_ID.web.app,https://$PROJECT_ID.firebaseapp.com" \
  --quiet

BACKEND_URL=$(gcloud run services describe ai-scoring-backend --region $REGION --format="value(status.url)")
echo "✓ 後端部署完成：$BACKEND_URL"

# Step 6：建置並部署前端
echo ""
echo "▶ Step 6：建置前端..."
cd ~/ai-scoring/frontend

# 更新 .env.production
echo "VITE_API_BASE_URL=$BACKEND_URL/api" > .env.production
npm install
npm run build
echo "✓ 前端建置完成"

# Step 7：部署前端到 Firebase Hosting
echo ""
echo "▶ Step 7：部署前端到 Firebase Hosting..."
npm install -g firebase-tools

# 初始化並部署
firebase use $PROJECT_ID --add 2>/dev/null || true
firebase deploy --only hosting --project $PROJECT_ID

echo ""
echo "================================================"
echo "  🎉 部署完成！"
echo "  後端 API：$BACKEND_URL"
echo "  前端網址：https://$PROJECT_ID.web.app"
echo "================================================"
