const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/periods
router.get('/', authenticate, async (req, res) => {
  const periods = await prisma.period.findMany({
    include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    orderBy: { startDate: 'desc' },
  });
  res.json(periods);
});

// GET /api/periods/:id
router.get('/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  const period = await prisma.period.findUnique({
    where: { id },
    include: { criteria: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!period) return res.status(404).json({ error: '期別不存在' });
  res.json(period);
});

// POST /api/periods
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, startDate, endDate } = req.body;
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: '請提供名稱、開始日期與結束日期' });
  }
  const period = await prisma.period.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });
  res.status(201).json(period);
});

// PUT /api/periods/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, startDate, endDate, isOpen } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (isOpen !== undefined) data.isOpen = Boolean(isOpen);
  const period = await prisma.period.update({ where: { id }, data });
  res.json(period);
});

// DELETE /api/periods/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.period.delete({ where: { id } });
  res.json({ message: '已刪除' });
});

module.exports = router;
