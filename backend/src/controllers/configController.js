const prisma = require('../prisma');

exports.getAll = async (req, res) => {
  const configs = await prisma.systemConfig.findMany();
  const result = {};
  for (const c of configs) result[c.key] = c.value;
  res.json(result);
};

exports.update = async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: '請提供 value' });
  const cfg = await prisma.systemConfig.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) },
  });
  res.json(cfg);
};
