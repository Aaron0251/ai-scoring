#!/bin/bash
# 前端部署到 Cloud Run（nginx 靜態伺服器）
set -e

REGION="asia-east1"
BACKEND_SERVICE="ai-scoring-backend"
FRONTEND_SERVICE="ai-scoring-frontend"

cd ~/ai-scoring/frontend

# ── Step 1：取得後端網址 ──────────────────────────────────
echo "▶ 取得後端網址..."
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
  --region "$REGION" \
  --format "value(status.url)")

if [ -z "$BACKEND_URL" ]; then
  echo "❌ 無法取得後端網址，請先部署後端（bash deploy-backend.sh）"
  exit 1
fi
echo "  後端網址：$BACKEND_URL"

# ── Step 2：寫入正式環境設定 ─────────────────────────────
echo "▶ 寫入 .env.production..."
echo "VITE_API_BASE_URL=${BACKEND_URL}" > .env.production
cat .env.production

# ── Step 3：安裝依賴並建置 ───────────────────────────────
echo "▶ 安裝依賴..."
npm install

echo "▶ 建置前端（含新版存取控制與 Dashboard 篩選功能）..."
npm run build

echo "  build 完成，dist 大小：$(du -sh dist | cut -f1)"

# ── Step 4：部署到 Cloud Run ─────────────────────────────
echo "▶ 部署前端到 Cloud Run..."
gcloud run deploy "$FRONTEND_SERVICE" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --timeout 30

echo ""
echo "✓ 前端部署完成！"
FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
  --region "$REGION" \
  --format "value(status.url)")
echo "  前端網址：$FRONTEND_URL"
