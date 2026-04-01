require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ── 路由 ──────────────────────────────────────
const authRoutes               = require('./routes/auth');
const divisionsRoutes          = require('./routes/divisions');
const departmentsRoutes        = require('./routes/departments');
const sectionsRoutes           = require('./routes/sections');
const deptPersonsRoutes        = require('./routes/dept-persons');
const usersRoutes              = require('./routes/users');
const orgChiefsRoutes          = require('./routes/org-chiefs');
const scenesRoutes             = require('./routes/scenes');
const executionLogsRoutes      = require('./routes/execution-logs');
const importRoutes             = require('./routes/import');
const configRoutes             = require('./routes/config');
const dashboardRoutes          = require('./routes/dashboard');
// 评分相关路由已删除
const efficiencyReportsRoutes  = require('./routes/efficiency-reports');
const actualSavingsRoutes       = require('./routes/actual-savings');

const app = express();
const PORT = process.env.PORT || 3001;

// ── 信任反向代理（Railway / Heroku 等平台需要）──
app.set('trust proxy', 1);

// ── 安全 Headers ──────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ──────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5174')
  .split(',')
  .map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // 允許所有 Vercel preview deployment（*.vercel.app）
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── 通用限速（防 DoS）────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '請求過於頻繁，請稍後再試' },
});
app.use(generalLimiter);

// ── Body Parser ───────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── 路由掛載 ─────────────────────────────────
app.use('/api/auth',                    authRoutes);
app.use('/api/divisions',               divisionsRoutes);
app.use('/api/departments',             departmentsRoutes);
app.use('/api/sections',                sectionsRoutes);
app.use('/api/dept-persons',            deptPersonsRoutes);
app.use('/api/users',                   usersRoutes);
app.use('/api/org-chiefs',              orgChiefsRoutes);
app.use('/api/scenes',                  scenesRoutes);
app.use('/api/scenes/:sceneId/execution-logs', executionLogsRoutes);
app.use('/api/scenes/:sceneId/actual-savings', actualSavingsRoutes);
app.use('/api/import',                  importRoutes);
app.use('/api/config',                  configRoutes);
app.use('/api/dashboard',               dashboardRoutes);
// 评分相关路由已删除
app.use('/api/efficiency-reports',      efficiencyReportsRoutes);

// ── Health Check ──────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// ── 404 Handler ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `找不到路由：${req.method} ${req.path}` });
});

// ── 全域錯誤處理 ─────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err);

  // Multer 錯誤
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: '檔案大小超過限制（最大 10MB）' });
  }
  if (err.message && err.message.includes('僅接受')) {
    return res.status(400).json({ error: err.message });
  }

  // Prisma 唯一鍵衝突
  if (err.code === 'P2002') {
    return res.status(409).json({ error: '資料已存在，請勿重複新增' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: '找不到指定資料' });
  }

  res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
});

app.listen(PORT, () => {
  console.log(`\nAI 推動評分系統 v2 後端`);
  console.log(`伺服器運行於：http://localhost:${PORT}`);
  console.log(`環境：${process.env.NODE_ENV || 'development'}\n`);
});
