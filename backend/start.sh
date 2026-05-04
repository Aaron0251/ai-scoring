#!/bin/sh
# Cloud Run 啟動腳本：同步 Schema，再啟動 Server
set -e

echo "▶ 執行 Prisma Migration..."
npx prisma migrate deploy
echo "✓ Migration 完成"

echo "▶ 啟動 Node.js Server..."
exec node src/index.js
