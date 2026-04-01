const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/config
router.get('/', authenticate, async (req, res) => {
  const configs = await prisma.systemConfig.findMany();
  const result = {};
  for (const c of configs) result[c.key] = c.value;
  res.json(result);
});

// PUT /api/config/:key
router.put('/:key', authenticate, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: '請提供 value' });

  const cfg = await prisma.systemConfig.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
  res.json(cfg);
});

module.exports = router;
