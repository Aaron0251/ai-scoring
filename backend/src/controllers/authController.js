const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { getAllowedFeaturesForRoles } = require('./rolePermissionController');

const JWT_SECRET = process.env.JWT_SECRET;

function parseRoles(user) {
  try { return JSON.parse(user.roles); } catch { return [user.roles]; }
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '請提供帳號與密碼' });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !user.active) {
      return res.status(401).json({ error: '帳號不存在或已停用' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '密碼錯誤' });
    }

    const roles = parseRoles(user);
    const allowedFeatures = await getAllowedFeaturesForRoles(roles);
    const token = jwt.sign(
      { id: user.id, username: user.username, roles, name: user.name, divisionId: user.divisionId, departmentId: user.departmentId },
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
        allowedFeatures,
        divisionId: user.divisionId,
        departmentId: user.departmentId,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
};

exports.me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { department: { include: { division: true } } },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: '使用者不存在' });
  }
  const roles = parseRoles(user);
  const allowedFeatures = await getAllowedFeaturesForRoles(roles);
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    roles,
    allowedFeatures,
    divisionId: user.divisionId,
    departmentId: user.departmentId,
    department: user.department,
    mustChangePassword: user.mustChangePassword,
  });
};

exports.changePassword = async (req, res) => {
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
};
