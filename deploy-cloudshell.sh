#!/bin/bash
# ============================================================
# AI 推動評分系統 - GCP Cloud Shell 一鍵部署腳本
# 在 Google Cloud Shell 執行此腳本
# ============================================================

set -e

# ── 環境設定 ──────────────────────────────────────────────
PROJECT_ID="vertex-ai-491502"
REGION="asia-east1"
CONNECTION_NAME="vertex-ai-491502:asia-east1:pg-instance"   # 現有 Cloud SQL 執行個體
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD='P@ssw0rd#2026'
JWT_SECRET="ai-scoring-jwt-secret-key-2026-fme"             # 可自行修改
# ──────────────────────────────────────────────────────────

echo "================================================"
echo "  AI 推動評分系統 GCP 部署"
echo "  專案 ID  ：$PROJECT_ID"
echo "  Cloud SQL：$CONNECTION_NAME"
echo "  資料庫   ：$DB_NAME"
echo "================================================"

# 設定預設專案
gcloud config set project $PROJECT_ID --quiet

# Step 1：啟用必要 API
echo ""
echo "▶ Step 1：啟用 GCP API..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --quiet
echo "✓ API 啟用完成"

# Step 2：執行資料庫 Migration（透過 Cloud SQL Auth Proxy）
echo ""
echo "▶ Step 2：執行資料庫 Migration..."
cd ~/ai-scoring/backend
npm install

# 下載 Cloud SQL Auth Proxy
echo "  下載 Cloud SQL Auth Proxy..."
curl -sLo cloud-sql-proxy \
  https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# 背景執行 Proxy（port 5434 避免衝突）
./cloud-sql-proxy "$CONNECTION_NAME" --port 5434 &
PROXY_PID=$!
echo "  Proxy 啟動中，等待連線..."
sleep 8

# 執行 Migration
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5434/${DB_NAME}" \
DIRECT_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5434/${DB_NAME}" \
npx prisma migrate deploy

# 停止 Proxy
kill $PROXY_PID 2>/dev/null || true
echo "✓ 資料庫 Migration 完成"

# Step 3：部署後端到 Cloud Run
echo ""
echo "▶ Step 3：部署後端到 Cloud Run（約需 3-5 分鐘）..."
cd ~/ai-scoring/backend

# 密碼含特殊字元，需做 URL encode（@ → %40，# → %23）
DB_PASS_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}', safe=''))")
DB_URL="postgresql://${DB_USER}:${DB_PASS_ENCODED}@localhost/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

gcloud run deploy ai-scoring-backend \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances "$CONNECTION_NAME" \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "JWT_SECRET=${JWT_SECRET}" \
  --set-env-vars "DATABASE_URL=${DB_URL}" \
  --set-env-vars "DIRECT_URL=${DB_URL}" \
  --set-env-vars "FRONTEND_URL=https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com" \
  --quiet

BACKEND_URL=$(gcloud run services describe ai-scoring-backend \
  --region "$REGION" --format="value(status.url)")
echo "✓ 後端部署完成：$BACKEND_URL"

# Step 4：建置前端
echo ""
echo "▶ Step 4：建置前端..."
cd ~/ai-scoring/frontend
npm install

# 寫入正式環境 API 網址
echo "VITE_API_BASE_URL=${BACKEND_URL}/api" > .env.production
cat .env.production

npm run build
echo "✓ 前端建置完成"

# Step 5：部署前端到 Firebase Hosting
echo ""
echo "▶ Step 5：部署前端到 Firebase Hosting..."
npm install -g firebase-tools --quiet

firebase deploy --only hosting --project "$PROJECT_ID"

echo ""
echo "================================================"
echo "  🎉 部署完成！"
echo "  後端 API ：$BACKEND_URL"
echo "  前端網址 ：https://${PROJECT_ID}.web.app"
echo "================================================"
