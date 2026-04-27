#!/bin/bash
# Cloud Shell 前端部署腳本
set -e

cd ~/ai-scoring/frontend

echo "▶ 安裝前端依賴..."
npm install

echo "▶ 建置前端 (production)..."
npm run build

echo "▶ 部署到 Firebase Hosting..."
npx firebase deploy --only hosting --project vertex-ai-491502

echo ""
echo "✓ 前端部署完成！"
echo "▶ 網址：https://vertex-ai-491502.web.app"
