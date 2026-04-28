#!/bin/bash
# Cloud Shell 後端部署腳本 - 自動建立環境變數並部署
set -e

cd ~/ai-scoring

# 載入機密設定（secrets.sh 不推上 GitHub）
if [ -f ~/ai-scoring/secrets.sh ]; then
  source ~/ai-scoring/secrets.sh
else
  echo "❌ 找不到 secrets.sh，請依 secrets.example.sh 建立並填入密碼"
  exit 1
fi

cd ~/ai-scoring/backend

echo "▶ 建立 cloudrun-env.yaml..."
DB_PASS_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}', safe=''))")
cat > cloudrun-env.yaml << ENVEOF
NODE_ENV: "production"
JWT_SECRET: "${JWT_SECRET}"
DATABASE_URL: "postgresql://postgres:${DB_PASS_ENCODED}@localhost/postgres?host=/cloudsql/vertex-ai-491502:asia-east1:pg-instance"
DIRECT_URL: "postgresql://postgres:${DB_PASS_ENCODED}@localhost/postgres?host=/cloudsql/vertex-ai-491502:asia-east1:pg-instance"
FRONTEND_URL: "https://ai-scoring-frontend-306010027590.asia-east1.run.app,https://ai-scoring-frontend-v3ddct6yyq-de.a.run.app"
ENVEOF
echo "cloudrun-env.yaml 建立完成"

echo "▶ 確認環境變數內容..."
cat cloudrun-env.yaml

echo ""
echo "▶ 開始部署到 Cloud Run（約需 3~5 分鐘）..."
gcloud run deploy ai-scoring-backend \
  --source . \
  --region asia-east1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances vertex-ai-491502:asia-east1:pg-instance \
  --env-vars-file cloudrun-env.yaml \
  --memory 512Mi \
  --timeout 60

echo ""
echo "✓ 後端部署完成！"
echo "▶ 取得後端網址..."
gcloud run services describe ai-scoring-backend \
  --region asia-east1 \
  --format "value(status.url)"
