#!/bin/bash
# Cloud Shell 後端部署腳本 - 自動建立環境變數並部署
set -e

cd ~/ai-scoring/backend

echo "▶ 建立 cloudrun-env.yaml..."
python3 << 'PYEOF'
lines = [
    'NODE_ENV: "production"',
    'JWT_SECRET: "ai-scoring-jwt-secret-fme-2026"',
    'DATABASE_URL: "postgresql://postgres:P%40ssw0rd%232026@localhost/postgres?host=/cloudsql/vertex-ai-491502:asia-east1:pg-instance"',
    'DIRECT_URL: "postgresql://postgres:P%40ssw0rd%232026@localhost/postgres?host=/cloudsql/vertex-ai-491502:asia-east1:pg-instance"',
    'FRONTEND_URL: "https://vertex-ai-491502.web.app,https://vertex-ai-491502.firebaseapp.com"',
]
with open('cloudrun-env.yaml', 'w') as f:
    f.write('\n'.join(lines) + '\n')
print('cloudrun-env.yaml 建立完成')
PYEOF

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
