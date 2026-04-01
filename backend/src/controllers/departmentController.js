const prisma = require('../prisma');

exports.getAll = async (req, res) => {
  const depts = await prisma.department.findMany({
    include: { division: true, sections: true },
    orderBy: [{ division: { name: 'asc' } }, { name: 'asc' }],
  });
  res.json(depts);
};

exports.create = async (req, res) => {
  const { name, divisionId } = req.body;
  if (!name || !divisionId) return res.status(400).json({ error: '請提供部門名稱與所屬本部' });
  try {
    const dept = await prisma.department.create({
      data: { name, divisionId: parseInt(divisionId) },
      include: { division: true },
    });
    res.status(201).json(dept);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: '同一本部下已有相同部門名稱' });
    res.status(500).json({ error: '新增失敗' });
  }
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, divisionId } = req.body;
  const data = {};
  if (name) data.name = name;
  if (divisionId) data.divisionId = parseInt(divisionId);
  try {
    const dept = await prisma.department.update({
      where: { id },
      data,
      include: { division: true },
    });
    res.json(dept);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: '同一本部下已有相同部門名稱' });
    res.status(500).json({ error: '更新失敗' });
  }
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.department.delete({ where: { id } });
    res.json({ message: '已刪除' });
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') return res.status(409).json({ error: '部門下屬尚有資料，請先刪除小筆資料' });
    res.status(500).json({ error: '刪除失敗' });
  }
};
