const express = require('express');
const prisma = require('../prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/efficiency-evaluations?periodId=X&evaluatorId=X
router.get('/', authenticate, async (req, res) => {
  const { periodId, evaluatorId } = req.query;
  const where = {};
  if (periodId) where.periodId = parseInt(periodId);
  if (evaluatorId) where.evaluatorId = parseInt(evaluatorId);
  if (!req.user.roles.includes('admin')) {
    where.evaluatorId = req.user.id;
  }
  const evals = await prisma.efficiencyEval.findMany({
    where,
    include: { criterion: true },
    orderBy: [{ periodId: 'desc' }, { criterionId: 'asc' }],
  });
  res.json(evals);
});

// PUT /api/efficiency-evaluations/:id — 填寫/更新一筆評分
router.put('/:id', authenticate, authorize('evaluator', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { score, note } = req.body;

  const evalRecord = await prisma.efficiencyEval.findUnique({ where: { id } });
  if (!evalRecord) return res.status(404).json({ error: '評分記錄不存在' });

  // 只能修改自己的評分（管理員可修改所有）
  if (!req.user.roles.includes('admin') && evalRecord.evaluatorId !== req.user.id) {
    return res.status(403).json({ error: '只能修改自己的評分' });
  }

  const criterion = await prisma.efficiencyCriterion.findUnique({ where: { id: evalRecord.criterionId } });
  if (score !== undefined && score !== null) {
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > criterion.maxScore) {
      return res.status(400).json({ error: `分數必須在 0 ~ ${criterion.maxScore} 之間` });
    }
  }

  const updated = await prisma.efficiencyEval.update({
    where: { id },
    data: {
      score: score !== undefined ? parseFloat(score) : evalRecord.score,
      note: note !== undefined ? note : evalRecord.note,
    },
  });
  res.json(updated);
});

// POST /api/efficiency-evaluations/submit?periodId=X — 提交一整期評分
router.post('/submit', authenticate, authorize('evaluator', 'admin'), async (req, res) => {
  const { periodId } = req.body;
  if (!periodId) return res.status(400).json({ error: '請提供 periodId' });

  const now = new Date();
  const result = await prisma.efficiencyEval.updateMany({
    where: { periodId: parseInt(periodId), evaluatorId: req.user.id, submitted: false },
    data: { submitted: true, submittedAt: now },
  });

  res.json({ message: `已提交 ${result.count} 筆評分`, count: result.count });
});

module.exports = router;
