const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/efficiency-criteria?periodId=X
router.get('/', authenticate, async (req, res) => {
  const { periodId } = req.query;
  const where = periodId ? { periodId: parseInt(periodId) } : {};
  const criteria = await prisma.efficiencyCriterion.findMany({
    where,
    include: { period: true },
    orderBy: [{ periodId: 'desc' }, { orderIndex: 'asc' }],
  });
  res.json(criteria);
});

// POST /api/efficiency-criteria
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { periodId, name, description, maxScore, weight, orderIndex } = req.body;
  if (!periodId || !name) return res.status(400).json({ error: '請提供期別與評核項目名稱' });
  const criterion = await prisma.efficiencyCriterion.create({
    data: {
      periodId: parseInt(periodId),
      name,
      description: description || null,
      maxScore: maxScore ? parseInt(maxScore) : 10,
      weight: weight ? parseFloat(weight) : 1.0,
      orderIndex: orderIndex ? parseInt(orderIndex) : 0,
    },
  });
  res.status(201).json(criterion);
});

// PUT /api/efficiency-criteria/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, description, maxScore, weight, orderIndex } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (maxScore !== undefined) data.maxScore = parseInt(maxScore);
  if (weight !== undefined) data.weight = parseFloat(weight);
  if (orderIndex !== undefined) data.orderIndex = parseInt(orderIndex);
  const criterion = await prisma.efficiencyCriterion.update({ where: { id }, data });
  res.json(criterion);
});

// DELETE /api/efficiency-criteria/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.efficiencyCriterion.delete({ where: { id } });
  res.json({ message: '已刪除' });
});

module.exports = router;
