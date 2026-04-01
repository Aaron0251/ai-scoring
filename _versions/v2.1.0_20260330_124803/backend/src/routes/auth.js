const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// 登入限速：每 15 分鐘最多 20 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '登入嘗試過多，請 15 分鐘後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '請提供帳號與密碼' });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }

  let roles;
  try {
    roles = JSON.parse(user.roles);
  } catch {
    roles = [user.roles];
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, roles, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      roles,
      departmentId: user.departmentId,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { department: { include: { division: true } } },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: '使用者不存在' });
  }
  let roles;
  try {
    roles = JSON.parse(user.roles);
  } catch {
    roles = [user.roles];
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    roles,
    departmentId: user.departmentId,
    department: user.department,
    mustChangePassword: user.mustChangePassword,
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '請提供舊密碼與新密碼' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密碼至少需要 6 個字元' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) {
    return res.status(400).json({ error: '舊密碼錯誤' });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  res.json({ message: '密碼變更成功' });
});

module.exports = router;
