const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { getAllowedFeaturesForRoles } = require('./rolePermissionController');

const JWT_SECRET = process.env.JWT_SECRET;
const EIP_API_URL = 'https://eip.fme.com.tw/FMEIP/AasApi/CheckUserId';

function parseRoles(user) {
  try { return JSON.parse(user.roles); } catch { return [user.roles]; }
}

/**
 * 呼叫 EIP AD 驗證 API
 * 回傳 { success: true } 或 { success: false, error: '...' }
 */
async function checkEipAuth(username, password) {
  try {
    const res = await fetch(EIP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ USER_ID: username, PSW: password }),
      signal: AbortSignal.timeout(8000), // 8 秒 timeout
    });

    if (!res.ok) {
      return { success: false, error: 'EIP 伺服器回應異常' };
    }

    const data = await res.json();
    const msg = data?.MSG || '';

    if (msg.startsWith('000')) return { success: true };
    if (msg.startsWith('100')) return { success: false, error: '帳號或密碼錯誤' };
    if (msg.startsWith('200')) return { success: false, error: 'AD 認證失敗，請確認帳號狀態' };
    if (msg.startsWith('998')) return { success: false, error: '公司系統暫時無法連線，請稍後再試' };
    return { success: false, error: '驗證失敗，請聯絡管理員' };
  } catch (err) {
    console.error('[EIP Auth Error]', err.message);
    return { success: false, error: '無法連線至公司驗證系統，請確認網路或改用系統帳號登入' };
  }
}

/**
 * 組合 JWT payload 與回傳 user 物件
 */
async function buildLoginResponse(user) {
  const roles = parseRoles(user);
  const allowedFeatures = await getAllowedFeaturesForRoles(roles);
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      roles,
      name: user.name,
      divisionId: user.divisionId,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      roles,
      allowedFeatures,
      divisionId: user.divisionId,
      departmentId: user.departmentId,
      sectionId: user.sectionId,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '請提供帳號與密碼' });
    }

    // ── 第一層：查系統 DB ──────────────────────────────────
    const user = await prisma.user.findUnique({ where: { username } });

    if (user) {
      if (!user.active) {
        return res.status(401).json({ error: '帳號已停用，請聯絡管理員' });
      }

      if (user.password) {
        // 系統帳號：驗 DB 密碼
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
          return res.status(401).json({ error: '密碼錯誤' });
        }
        return res.json(await buildLoginResponse(user));
      } else {
        // AD 帳號（DB 無密碼）：改走 EIP 驗證
        const eip = await checkEipAuth(username, password);
        if (!eip.success) {
          return res.status(401).json({ error: eip.error });
        }
        return res.json(await buildLoginResponse(user));
      }
    }

    // ── 第二層：DB 查無此帳號 → 嘗試 EIP AD 驗證 ──────────
    console.log(`[DEBUG] 第二層 EIP 驗證：${username}`);
    const eip = await checkEipAuth(username, password);
    if (!eip.success) {
      return res.status(401).json({ error: eip.error });
    }

    // EIP 驗證成功 → 首次登入，自動建立帳號（角色：chief）
    const newUser = await prisma.user.create({
      data: {
        username,
        password: null,           // AD 帳號不存 DB 密碼
        name: username,           // 暫用帳號當姓名，admin 可後續修改
        roles: JSON.stringify(['chief']),
        active: true,
        mustChangePassword: false,
      },
    });

    console.log(`[AD 首次登入] 自動建立帳號：${username}，角色：chief`);
    return res.json(await buildLoginResponse(newUser));

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
    sectionId: user.sectionId,
    department: user.department,
    mustChangePassword: user.mustChangePassword,
  });
};

exports.changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '請提供舊密碼與新密碼' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  // AD 帳號無 DB 密碼，不支援此功能
  if (!user.password) {
    return res.status(400).json({ error: 'AD 帳號請至公司系統修改密碼，無法在此變更' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密碼至少需要 6 個字元' });
  }

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
