const express = require('express');
const prisma = require('../prisma');
const { authenticate, authorize, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// GET /api/person-scores?periodId=X&evaluatorId=X
router.get('/', authenticate, async (req, res) => {
  const { periodId, evaluatorId } = req.query;
  const where = {};
  if (periodId) where.periodId = parseInt(periodId);
  if (evaluatorId) where.evaluatorId = parseInt(evaluatorId);
  // 非管理員只能看自己的評分
  const roles = req.user.roles;
  if (!roles.includes('admin') && !roles.includes('executive')) {
    where.evaluatorId = req.user.id;
  }
  const scores = await prisma.personScore.findMany({
    where,
    include: { criterion: true, deptPerson: true, evaluator: { select: { id: true, name: true } } },
    orderBy: [{ periodId: 'desc' }, { subjectType: 'asc' }],
  });
  res.json(scores);
});

// POST /api/person-scores — 建立或更新一筆評分
router.post('/', authenticate, authorize('evaluator', 'admin'), async (req, res) => {
  const { periodId, criterionId, subjectType, deptPersonId, subjectName, score, note } = req.body;

  if (!periodId || !criterionId || !subjectType) {
    return res.status(400).json({ error: '請提供 periodId、criterionId、subjectType' });
  }

  if (!['教官', '直屬主管'].includes(subjectType)) {
    return res.status(400).json({ error: 'subjectType 必須是「教官」或「直屬主管」' });
  }

  // 直屬主管必須有 deptPersonId；教官必須有 subjectName
  if (subjectType === '直屬主管' && !deptPersonId) {
    return res.status(400).json({ error: '評直屬主管時必須提供 deptPersonId' });
  }
  if (subjectType === '教官' && !subjectName) {
    return res.status(400).json({ error: '評教官時必須提供 subjectName' });
  }

  // 確認期別是否開放
  const period = await prisma.period.findUnique({ where: { id: parseInt(periodId) } });
  if (!period) return res.status(404).json({ error: '期別不存在' });
  if (!period.isOpen) return res.status(400).json({ error: '此期別尚未開放評分' });

  const criterion = await prisma.criterion.findUnique({ where: { id: parseInt(criterionId) } });
  if (!criterion) return res.status(404).json({ error: '評核項目不存在' });

  // 分數範圍驗證
  if (score !== undefined && score !== null) {
    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > criterion.maxScore) {
      return res.status(400).json({ error: `分數必須在 0 ~ ${criterion.maxScore} 之間` });
    }
  }

  const evaluatorId = req.user.id;
  const data = {
    periodId: parseInt(periodId),
    evaluatorId,
    criterionId: parseInt(criterionId),
    subjectType,
    deptPersonId: subjectType === '直屬主管' ? parseInt(deptPersonId) : null,
    subjectName: subjectType === '教官' ? subjectName : null,
    score: score !== undefined ? parseFloat(score) : null,
    note: note || null,
  };

  // upsert
  const existing = await prisma.personScore.findFirst({
    where: {
      periodId: data.periodId,
      evaluatorId: data.evaluatorId,
      criterionId: data.criterionId,
      subjectType: data.subjectType,
      deptPersonId: data.deptPersonId,
      subjectName: data.subjectName,
    },
  });

  let result;
  if (existing) {
    result = await prisma.personScore.update({
      where: { id: existing.id },
      data: { score: data.score, note: data.note },
    });
  } else {
    result = await prisma.personScore.create({ data });
  }

  res.json(result);
});

// POST /api/person-scores/submit — 一次提交某期別的所有評分
router.post('/submit', authenticate, authorize('evaluator', 'admin'), async (req, res) => {
  const { periodId } = req.body;
  if (!periodId) return res.status(400).json({ error: '請提供 periodId' });

  const now = new Date();
  const updated = await prisma.personScore.updateMany({
    where: {
      periodId: parseInt(periodId),
      evaluatorId: req.user.id,
      submitted: false,
    },
    data: { submitted: true, submittedAt: now },
  });

  res.json({ message: `已提交 ${updated.count} 筆評分`, count: updated.count });
});

// GET /api/person-scores/report?periodId=X
// 管理/高階查看匯總報表
router.get('/report', authenticate, authorize('admin', 'executive', 'chief'), async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: '請提供 periodId' });

  const scores = await prisma.personScore.findMany({
    where: { periodId: parseInt(periodId), submitted: true },
    include: {
      criterion: true,
      deptPerson: { include: { department: { include: { division: true } } } },
      evaluator: { select: { id: true, name: true, departmentId: true } },
    },
  });

  // 按受評對象彙整
  const map = new Map();
  for (const s of scores) {
    const key = s.subjectType === '教官'
      ? `教官_${s.subjectName}`
      : `直屬主管_${s.deptPersonId}`;

    if (!map.has(key)) {
      map.set(key, {
        subjectType: s.subjectType,
        subjectName: s.subjectType === '教官' ? s.subjectName : s.deptPerson?.name,
        deptPerson: s.deptPerson,
        scores: [],
      });
    }
    map.get(key).scores.push({
      criterionId: s.criterionId,
      criterionName: s.criterion.name,
      score: s.score,
      evaluatorId: s.evaluatorId,
    });
  }

  // 統計平均分
  const result = Array.from(map.values()).map(item => {
    const byCriterion = {};
    for (const s of item.scores) {
      if (!byCriterion[s.criterionId]) {
        byCriterion[s.criterionId] = { criterionName: s.criterionName, scores: [] };
      }
      if (s.score !== null) byCriterion[s.criterionId].scores.push(s.score);
    }
    const criteriaAvg = Object.values(byCriterion).map(c => ({
      criterionName: c.criterionName,
      avg: c.scores.length > 0
        ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length * 10) / 10
        : null,
      count: c.scores.length,
    }));
    return { ...item, scores: undefined, criteriaAvg };
  });

  res.json(result);
});

module.exports = router;
