const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * 驗證 JWT Token
 * req.user = { id, username, roles: string[], name, divisionId?, departmentId? }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供認證 Token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token 無效或已過期' });
  }
}

/**
 * 角色授權（多角色）
 * 用法：authorize('admin', 'manager')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      return res.status(403).json({ error: '權限不足' });
    }
    const hasRole = roles.some((r) => req.user.roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}

/**
 * 快捷：僅限管理員
 */
function requireAdmin(req, res, next) {
  if (!req.user || !Array.isArray(req.user.roles) || !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: '僅限管理員操作' });
  }
  next();
}

module.exports = { authenticate, authorize, requireAdmin };
