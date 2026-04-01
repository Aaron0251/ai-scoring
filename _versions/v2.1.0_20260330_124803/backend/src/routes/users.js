const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function parseRoles(user) {
  try { return JSON.parse(user.roles); } catch { return [user.roles]; }
}

// GET /api/users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    include: { department: { include: { division: true } } },
    orderBy: { username: 'asc' },
  });
  res.json(users.map(u => ({ ...u, roles: parseRoles(u), password: undefined })));
});

// GET /api/users/:id
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    include: { department: { include: { division: true } } },
  });
  if (!user) return res.status(404).json({ error: '使用者不存在' });
  res.json({ ...user, roles: parseRoles(user), password: undefined });
});

// POST /api/users
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { username, password, name, roles, departmentId } = req.body;
  if (!username || !password || !name || !roles) {
    return res.status(400).json({ error: '請提供帳號、密碼、姓名與角色' });
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'roles 必須為非空陣列' });
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
      departmentId: departmentId ? parseInt(departmentId) : null,
      mustChangePassword: true,
    },
    include: { department: true },
  });

  res.status(201).json({ ...user, roles: parseRoles(user), password: undefined });
});

// PUT /api/users/:id
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, roles, departmentId, active, mustChangePassword } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (roles !== undefined) {
    if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles 必須為陣列' });
    data.roles = JSON.stringify(roles);
  }
  if (departmentId !== undefined) data.departmentId = departmentId ? parseInt(departmentId) : null;
  if (active !== undefined) data.active = active;
  if (mustChangePassword !== undefined) data.mustChangePassword = mustChangePassword;

  const user = await prisma.user.update({
    where: { id },
    data,
    include: { department: true },
  });
  res.json({ ...user, roles: parseRoles(user), password: undefined });
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
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
});

// DELETE /api/users/:id（軟刪除）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: '無法停用自己的帳號' });
  }
  await prisma.user.update({ where: { id }, data: { active: false } });
  res.json({ message: '帳號已停用' });
});

module.exports = router;
