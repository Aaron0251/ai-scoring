const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/efficiency-periods
router.get('/', authenticate, async (req, res) => {
  const periods = await prisma.efficiencyPeriod.findMany({
    include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    orderBy: { startDate: 'desc' },
  });
  res.json(periods);
});

// POST /api/efficiency-periods
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, frequency, startDate, endDate, dueDate } = req.body;
  if (!name || !frequency || !startDate || !endDate) {
    return res.status(400).json({ error: '請提供名稱、頻率(週評|月評)、起迄日期' });
  }
  if (!['週評', '月評'].includes(frequency)) {
    return res.status(400).json({ error: 'frequency 必須是「週評」或「月評」' });
  }
  const period = await prisma.efficiencyPeriod.create({
    data: {
      name,
      frequency,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  res.status(201).json(period);
});

// PUT /api/efficiency-periods/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, frequency, startDate, endDate, dueDate, isOpen } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (frequency !== undefined) data.frequency = frequency;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  if (isOpen !== undefined) data.isOpen = Boolean(isOpen);
  const period = await prisma.efficiencyPeriod.update({ where: { id }, data });
  res.json(period);
});

// POST /api/efficiency-periods/:id/generate — 自動產生評分表
router.post('/:id/generate', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const period = await prisma.efficiencyPeriod.findUnique({
    where: { id },
    include: { criteria: true },
  });
  if (!period) return res.status(404).json({ error: '效率評估期別不存在' });
  if (period.scoreGenerated) return res.status(400).json({ error: '此期別已產生過評分表' });

  // 取得所有 evaluator 角色使用者
  const users = await prisma.user.findMany({ where: { active: true } });
  const evaluators = users.filter(u => {
    try { return JSON.parse(u.roles).includes('evaluator'); } catch { return false; }
  });

  // 為每位評核員建立評分記錄（評自己的部門主管，使用 targetId = evaluatorId 的主管）
  // 依期別類型，評核對象可後續擴展；目前先建立空白評分框架
  const evalsToCreate = [];
  for (const evaluator of evaluators) {
    for (const criterion of period.criteria) {
      evalsToCreate.push({
        periodId: id,
        criterionId: criterion.id,
        evaluatorId: evaluator.id,
        targetId: evaluator.id, // 預設自評，實際應由管理員配置評核對象
      });
    }
  }

  await prisma.efficiencyEval.createMany({ data: evalsToCreate, skipDuplicates: true });
  await prisma.efficiencyPeriod.update({
    where: { id },
    data: { scoreGenerated: true, generatedAt: new Date() },
  });

  res.json({ message: `已產生 ${evalsToCreate.length} 筆評分記錄`, count: evalsToCreate.length });
});

// DELETE /api/efficiency-periods/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.efficiencyPeriod.delete({ where: { id } });
  res.json({ message: '已刪除' });
});

module.exports = router;
