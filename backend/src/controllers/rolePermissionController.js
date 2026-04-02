const prisma = require('../prisma');
const { FEATURES } = require('../constants/features');

// 所有角色列表
const ALL_ROLES = ['admin', 'manager', 'chief', 'executive', 'evaluator', 'boss'];

/**
 * 初始化角色權限（如果資料庫為空，寫入預設值）
 * 每次後端啟動時呼叫，確保新功能有預設權限
 */
async function initDefaultPermissions() {
  for (const feature of FEATURES) {
    for (const role of ALL_ROLES) {
      const allowed = feature.defaultRoles.includes(role);
      await prisma.rolePermission.upsert({
        where: { role_featureKey: { role, featureKey: feature.key } },
        create: { role, featureKey: feature.key, allowed },
        update: {}, // 已存在的不覆蓋（保留管理員設定）
      });
    }
  }
}

/**
 * GET /api/role-permissions
 * 取得所有角色的功能權限（管理員用）
 * 回傳格式：{ [role]: { [featureKey]: boolean } }
 */
exports.getAll = async (req, res) => {
  try {
    await initDefaultPermissions();

    const records = await prisma.rolePermission.findMany();

    // 組合成 { role: { featureKey: allowed } } 格式
    const result = {};
    for (const role of ALL_ROLES) {
      result[role] = {};
      for (const feature of FEATURES) {
        const rec = records.find(r => r.role === role && r.featureKey === feature.key);
        result[role][feature.key] = rec ? rec.allowed : feature.defaultRoles.includes(role);
      }
    }

    // 同時回傳 features 清單（給前端動態渲染用）
    res.json({ permissions: result, features: FEATURES, roles: ALL_ROLES });
  } catch (err) {
    res.status(500).json({ error: '取得角色權限失敗：' + err.message });
  }
};

/**
 * PUT /api/role-permissions
 * 批次更新角色功能權限
 * Body: { role: string, featureKey: string, allowed: boolean }[]
 */
exports.updateBatch = async (req, res) => {
  try {
    const updates = req.body;
    if (!Array.isArray(updates)) return res.status(400).json({ error: '格式錯誤' });

    for (const { role, featureKey, allowed } of updates) {
      if (!role || !featureKey || typeof allowed !== 'boolean') continue;
      await prisma.rolePermission.upsert({
        where: { role_featureKey: { role, featureKey } },
        create: { role, featureKey, allowed },
        update: { allowed },
      });
    }

    res.json({ success: true, updated: updates.length });
  } catch (err) {
    res.status(500).json({ error: '更新角色權限失敗：' + err.message });
  }
};

/**
 * 取得指定角色的允許功能 key 列表（供登入時使用）
 */
async function getAllowedFeaturesForRoles(roles) {
  await initDefaultPermissions();
  const records = await prisma.rolePermission.findMany({
    where: { role: { in: roles }, allowed: true },
  });
  // 取聯集（有任一角色有此功能即視為有權限）
  return [...new Set(records.map(r => r.featureKey))];
}

module.exports = { ...module.exports, getAllowedFeaturesForRoles, initDefaultPermissions };
