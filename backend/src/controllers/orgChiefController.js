const prisma = require('../prisma');

exports.getAll = async (req, res) => {
  const chiefs = await prisma.orgChief.findMany({
    where: { active: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json(chiefs);
};

exports.create = async (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) return res.status(400).json({ error: '請提供姓名與角色' });
  const validRoles = ['總機關首長', '本部主管'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `角色必須是：${validRoles.join('、')}` });
  }
  const chief = await prisma.orgChief.create({ data: { name, role } });
  res.status(201).json(chief);
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, role, active } = req.body;
  const data = {};
  if (name   !== undefined) data.name   = name;
  if (role   !== undefined) data.role   = role;
  if (active !== undefined) data.active = active;
  const chief = await prisma.orgChief.update({ where: { id }, data });
  res.json(chief);
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.orgChief.update({ where: { id }, data: { active: false } });
  res.json({ message: '已停用' });
};
