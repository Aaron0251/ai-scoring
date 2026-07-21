const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

/**
 * Cloud Run 環境下，DATABASE_URL 格式為：
 *   postgresql://user:pass@localhost/db?host=/cloudsql/<connection-name>
 * pg.Pool 不一定能正確解析 ?host= 這個 Prisma 特有的 socket 路徑參數，
 * 因此手動解析 URL，明確傳入 host（Unix socket 目錄）給 Pool。
 */
function createPool(connectionString) {
  try {
    const url = new URL(connectionString);
    const socketPath = url.searchParams.get('host');
    if (socketPath) {
      return new Pool({
        host:     socketPath,
        database: url.pathname.replace(/^\//, ''),
        user:     decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
      });
    }
  } catch (_) {
    // URL 解析失敗時 fallback 到原始字串
  }
  return new Pool({ connectionString });
}

const pool    = createPool(process.env.DATABASE_URL || '');
const adapter = new PrismaPg(pool);
// 全域 omit：ResourceItem.fileData（檔案內容）預設不撈，
// 避免列表查詢把所有檔案 bytes 一起載入。僅下載端點會明確 omit:false 取回。
const prisma  = new PrismaClient({
  adapter,
  omit: { resourceItem: { fileData: true } },
});

/**
 * 啟動時確保 ResourceItem 具備 fileData 欄位。
 * 上傳檔案改存資料庫（原本存 Cloud Run 暫時磁碟，容器重啟即遺失）。
 * 正式映像不含 prisma CLI，故以冪等 DDL 於啟動時自我套用，
 * 不需外部 migration 步驟、不需額外 GCP 權限（沿用現有資料庫連線）。
 */
prisma.ensureSchema = async function ensureSchema() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE ai_scoring."ResourceItem" ADD COLUMN IF NOT EXISTS "fileData" BYTEA'
  );
};

module.exports = prisma;
