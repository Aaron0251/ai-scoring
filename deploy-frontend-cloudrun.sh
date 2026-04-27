#!/bin/bash
# 前端部署到 Cloud Run（nginx 靜態伺服器）
set -e

cd ~/ai-scoring/frontend

echo "▶ 建置前端..."
npm install
npm run build

echo "▶ 部署前端到 Cloud Run..."
gcloud run deploy ai-scoring-frontend \
  --source . \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --timeout 30

echo ""
echo "✓ 前端部署完成！"
gcloud run services describe ai-scoring-frontend \
  --region asia-east1 \
  --format "value(status.url)"
