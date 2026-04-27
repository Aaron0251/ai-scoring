#!/bin/bash
# 在 Cloud Shell 執行 seed 腳本（初始化資料庫基本資料）
set -e

cd ~/ai-scoring/backend

echo "▶ 啟動 Cloud SQL Auth Proxy..."
cloud_sql_proxy vertex-ai-491502:asia-east1:pg-instance &
PROXY_PID=$!
sleep 3

echo "▶ 執行 Seed 腳本..."
DATABASE_URL="postgresql://postgres:P%40ssw0rd%232026@localhost:5432/postgres" \
DIRECT_URL="postgresql://postgres:P%40ssw0rd%232026@localhost:5432/postgres" \
node src/seed.js

echo "✓ Seed 完成！"
echo "  可用帳號："
echo "  admin / admin1234"
echo "  manager1 / manager1234"

kill $PROXY_PID 2>/dev/null || true
