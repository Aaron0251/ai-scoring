const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

function parseRoles(user) {
  try { return JSON.parse(user.roles); } catch { return [user.roles]; }
}

const orgInclude = {
  division: true,
  department: { include: { division: true } },
  section: { include: { department: { include: { division: true } } } },
};

exports.getAll = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: orgInclude,
      orderBy: { username: 'asc' },
    });
    res.json(users.map(u => ({ ...u, roles: parseRoles(u), password: undefined })));
  } catch (err) {
    res.status(500).json({ error: '取得使用者清單失敗：' + err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id }, include: orgInclude });
    if (!user) return res.status(404).json({ error: '使用者不存在' });
    res.json({ ...user, roles: parseRoles(user), password: undefined });
  } catch (err) {
    res.status(500).json({ error: '取得使用者失敗：' + err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { username, password, name, roles, divisionId, departmentId, sectionId } = req.body;
    if (!username || !password || !name || !roles) {
      return res.status(400).json({ error: '請提供帳號、密碼、姓名與角色' });
    }
    if (!Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: '請至少選擇一個角色' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密碼至少需要 6 個字元' });
    }

    const existing = await prisma.user.findFirst({ where: { username, active: true } });
    if (existing) return res.status(400).json({ error: '帳號已存在' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashed,
        name,
        roles: JSON.stringify(roles),
        divisionId:   divisionId   ? parseInt(divisionId)   : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        sectionId:    sectionId    ? parseInt(sectionId)    : null,
        mustChangePassword: true,
      },
      include: orgInclude,
    });
    res.status(201).json({ ...user, roles: parseRoles(user), password: undefined });
  } catch (err) {
    res.status(500).json({ error: '建立使用者失敗：' + err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, roles, divisionId, departmentId, sectionId, active, mustChangePassword } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (roles !== undefined) {
      if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles 必須為陣列' });
      if (roles.length === 0) return res.status(400).json({ error: '請至少選擇一個角色' });
      data.roles = JSON.stringify(roles);
    }
    if (divisionId  !== undefined) data.divisionId  = divisionId  ? parseInt(divisionId)  : null;
    if (departmentId !== undefined) data.departmentId = departmentId ? parseInt(departmentId) : null;
    if (sectionId   !== undefined) data.sectionId   = sectionId   ? parseInt(sectionId)   : null;
    if (active !== undefined) data.active = active;
    if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;

    const user = await prisma.user.update({ where: { id }, data, include: orgInclude });
    res.json({ ...user, roles: parseRoles(user), password: undefined });
  } catch (err) {
    res.status(500).json({ error: '更新使用者失敗：' + err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密碼至少需要 6 個字元' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id },
      data: { password: hashed, mustChangePassword: true },
    });
    res.json({ message: '密碼已重設，使用者下次登入必須變更密碼' });
  } catch (err) {
    res.status(500).json({ error: '重設密碼失敗：' + err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: '無法刪除自己的帳號' });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ message: '帳號已刪除' });
  } catch (err) {
    res.status(500).json({ error: '刪除使用者失敗：' + err.message });
  }
};

// 取得尚未有帳號的組織人員清單
exports.getOrgPersonsWithoutAccount = async (req, res) => {
  try {
    const persons = await prisma.deptPerson.findMany({
      where: { active: true },
      include: {
        division: true,
        department: { include: { division: true } },
        section: { include: { department: { include: { division: true } } } },
      },
      orderBy: { id: 'asc' },
    });
    const users = await prisma.user.findMany({ select: { name: true, divisionId: true, departmentId: true, sectionId: true } });
    // 過濾出尚未有相符帳號的人員（同名且同組織）
    const withoutAccount = persons.filter(p => {
      return !users.some(u =>
        u.name === p.name &&
        u.divisionId === p.divisionId &&
        u.departmentId === p.departmentId &&
        u.sectionId === p.sectionId
      );
    });
    res.json(withoutAccount);
  } catch (err) {
    res.status(500).json({ error: '取得人員清單失敗：' + err.message });
  }
};

// 批次從組織人員建立帳號
exports.batchCreateFromOrg = async (req, res) => {
  try {
    const { persons } = req.body; // [{ deptPersonId, username, roles }]
    if (!Array.isArray(persons) || persons.length === 0) {
      return res.status(400).json({ error: '請提供人員清單' });
    }
    const defaultPassword = await bcrypt.hash('abc123456', 12);
    const created = [];
    const failed = [];
    for (const item of persons) {
      const { deptPersonId, username, roles } = item;
      if (!username || !roles || roles.length === 0) { failed.push({ username, reason: '缺少帳號或角色' }); continue; }
      try {
        const person = await prisma.deptPerson.findUnique({ where: { id: deptPersonId } });
        if (!person) { failed.push({ username, reason: '找不到對應人員' }); continue; }
        const existing = await prisma.user.findFirst({ where: { username } });
        if (existing) { failed.push({ username, reason: '帳號已存在' }); continue; }
        const user = await prisma.user.create({
          data: {
            username,
            password: defaultPassword,
            name: person.name,
            roles: JSON.stringify(roles),
            divisionId: person.divisionId,
            departmentId: person.departmentId,
            sectionId: person.sectionId,
            mustChangePassword: true,
          },
        });
        created.push({ username, name: person.name });
      } catch (e) {
        failed.push({ username, reason: e.message });
      }
    }
    res.json({ created, failed, message: `成功建立 ${created.length} 筆，失敗 ${failed.length} 筆` });
  } catch (err) {
    res.status(500).json({ error: '批次建立帳號失敗：' + err.message });
  }
};
