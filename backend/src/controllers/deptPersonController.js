const prisma = require('../prisma');

exports.getAll = async (req, res) => {
  const { divisionId, departmentId, sectionId } = req.query;
  const where = {};
  if (divisionId)   where.divisionId   = parseInt(divisionId);
  if (departmentId) where.departmentId = parseInt(departmentId);
  if (sectionId)    where.sectionId    = parseInt(sectionId);
  const persons = await prisma.deptPerson.findMany({
    where,
    include: {
      division:   true,
      department: { include: { division: true } },
      section:    { include: { department: { include: { division: true } } } },
    },
    orderBy: [{ name: 'asc' }],
  });
  res.json(persons);
};

exports.create = async (req, res) => {
  const { name, title, divisionId, departmentId, sectionId } = req.body;
  if (!name) return res.status(400).json({ error: '請提供姓名' });
  if (!divisionId && !departmentId && !sectionId) {
    return res.status(400).json({ error: '請指定所屬本部、部門或課級' });
  }
  const person = await prisma.deptPerson.create({
    data: {
      name,
      title: title || '',
      divisionId:   divisionId   ? parseInt(divisionId)   : null,
      departmentId: departmentId ? parseInt(departmentId) : null,
      sectionId:    sectionId    ? parseInt(sectionId)    : null,
    },
    include: { division: true, department: true, section: true },
  });
  res.status(201).json(person);
};

exports.update = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, title } = req.body;
  const data = {};
  if (name  !== undefined) data.name  = name;
  if (title !== undefined) data.title = title;
  const person = await prisma.deptPerson.update({
    where: { id },
    data,
    include: { division: true, department: true, section: true },
  });
  res.json(person);
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.deptPerson.delete({ where: { id } });
    res.json({ message: '已刪除' });
  } catch (e) {
    if (e.code === 'P2003' || e.code === 'P2014') {
      return res.status(409).json({ error: '此人員已有評分紀錄，無法刪除' });
    }
    res.status(500).json({ error: '刪除失敗' });
  }
};
