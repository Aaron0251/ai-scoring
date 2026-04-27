#!/bin/sh
# Cloud Run 啟動腳本：同步 Schema，再啟動 Server
set -e

echo "▶ 同步 Prisma Schema..."
npx prisma db push --accept-data-loss
echo "✓ Schema 同步完成"

echo "▶ 啟動 Node.js Server..."
exec node src/index.js
