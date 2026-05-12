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
const prisma  = new PrismaClient({ adapter });

module.exports = prisma;
