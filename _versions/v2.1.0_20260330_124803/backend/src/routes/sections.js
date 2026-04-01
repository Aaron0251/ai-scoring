const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/sections
router.get('/', authenticate, async (req, res) => {
  const { departmentId } = req.query;
  const where = departmentId ? { departmentId: parseInt(departmentId) } : {};
  const sections = await prisma.section.findMany({
    where,
    include: { department: { include: { division: true } } },
    orderBy: [
      { department: { division: { name: 'asc' } } },
      { department: { name: 'asc' } },
      { name: 'asc' },
    ],
  });
  res.json(sections);
});

// POST /api/sections
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, departmentId } = req.body;
  if (!name || !departmentId) return res.status(400).json({ error: '請提供課級名稱與所屬部門' });
  try {
    const section = await prisma.section.create({
      data: { name, departmentId: parseInt(departmentId) },
      include: { department: { include: { division: true } } },
    });
    res.status(201).json(section);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: '同一部門下已有相同課級名稱' });
    res.status(500).json({ error: '新增失敗' });
  }
});

// PUT /api/sections/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, departmentId } = req.body;
  const data = {};
  if (name) data.name = name;
  if (departmentId) data.departmentId = parseInt(departmentId);
  try {
    const section = await prisma.section.update({
      where: { id },
      data,
      include: { department: { include: { division: true } } },
    });
    res.json(section);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: '同一部門下已有相同課級名稱' });
    res.status(500).json({ error: '更新失敗' });
  }
});

// DELETE /api/sections/:id
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.section.delete({ where: { id } });
    res.json({ message: '已刪除' });
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') return res.status(409).json({ error: '課級下屬尚有場景或人員，請先刪除小筆資料' });
    if (e.code === 'P2025') return res.status(404).json({ error: '找不到該課級' });
    res.status(500).json({ error: '刪除失敗' });
  }
});

module.exports = router;
