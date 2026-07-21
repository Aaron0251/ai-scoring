-- 將資源庫上傳檔案改存資料庫（原存 Cloud Run 暫時磁碟，容器重啟即遺失）
-- 使用 IF NOT EXISTS 以與應用程式啟動時的冪等 DDL 相容，避免重複套用衝突
ALTER TABLE "ai_scoring"."ResourceItem" ADD COLUMN IF NOT EXISTS "fileData" BYTEA;
