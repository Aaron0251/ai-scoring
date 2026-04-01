const prisma = require('../prisma');

exports.getAll = async (req, res) => {
  const divisions = await prisma.division.findMany({
    include: { departments: { include: { sections: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(divisions);
};

exports.create = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '請提供本部名稱' });
  try {
    const division = await prisma.division.create({ data: { name } });
    res.status(201).json(division);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: '本部名稱已存在' });
    res.status(500).json({ error: '新增失敗' });
  }
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: '請提供本部名稱' });
  try {
    const division = await prisma.division.update({ where: { id }, data: { name } });
    res.json(division);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: '本部名稱已存在' });
    res.status(500).json({ error: '更新失敗' });
  }
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.division.delete({ where: { id } });
    res.json({ message: '已刪除' });
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') return res.status(409).json({ error: '本部下屬尚有部門，請先刪除兒層資料' });
    res.status(500).json({ error: '刪除失敗' });
  }
};
