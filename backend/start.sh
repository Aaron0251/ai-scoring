#!/bin/sh
# Cloud Run 啟動腳本
set -e

echo "▶ 啟動 Node.js Server..."
exec node src/index.js
