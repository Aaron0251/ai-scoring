const prisma = require('../prisma');

const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// GET /api/scenes/:sceneId/actual-savings
async function getAll(req, res, next) {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const rows = await prisma.sceneActualSavings.findMany({
      where: { sceneId },
      orderBy: { year: 'asc' },
    });
    res.json(rows);
  } catch (err) { next(err); }
}

// PUT /api/scenes/:sceneId/actual-savings/:year
async function upsert(req, res, next) {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const year    = parseInt(req.params.year);
    if (!year || year < 2020 || year > 2099) return res.status(400).json({ error: '年份無效' });

    const data = {};
    for (const k of MONTH_KEYS) {
      const v = req.body[k];
      data[k] = (v !== undefined && v !== null && v !== '') ? parseFloat(v) : null;
    }

    const row = await prisma.sceneActualSavings.upsert({
      where: { sceneId_year: { sceneId, year } },
      update: data,
      create: { sceneId, year, ...data },
    });
    res.json(row);
  } catch (err) { next(err); }
}

module.exports = { getAll, upsert };
