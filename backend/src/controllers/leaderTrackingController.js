const prisma = require('../prisma');

// ── 輔助：判斷當前使用者可以查看哪些 divisionId ──────────────
async function getAllowedDivisionIds(user) {
  const roles = user.roles;
  // admin / executive / chief → 全部本部
  if (roles.includes('admin') || roles.includes('executive') || roles.includes('chief')) {
    return null; // null 代表不限制
  }
  // manager → 只能看自己的本部
  if (roles.includes('manager')) {
    if (user.divisionId) return [user.divisionId];
    return [];
  }
  return [];
}

// GET /api/leader-tracking
// 取得種子負責人（manager role 使用者）列表，含場景統計
// 關聯邏輯：場景的 seedOwners 欄位包含該 manager 的姓名
exports.getLeaders = async (req, res) => {
  try {
    const allowedDivIds = await getAllowedDivisionIds(req.user);

    // 查詢 manager 角色使用者
    const where = { active: true };
    if (allowedDivIds !== null) {
      if (allowedDivIds.length === 0) return res.json([]);
      where.divisionId = { in: allowedDivIds };
    }

    const allUsers = await prisma.user.findMany({
      where,
      include: {
        division: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: [{ divisionId: 'asc' }, { name: 'asc' }],
    });

    // 篩選有 manager role 的使用者
    const managers = allUsers.filter(u => {
      try {
        const roles = typeof u.roles === 'string' ? JSON.parse(u.roles) : u.roles;
        return Array.isArray(roles) && roles.includes('manager');
      } catch { return false; }
    });

    if (managers.length === 0) return res.json([]);

    // 一次性取得所有場景（依權限範圍）
    const sceneWhere = { active: true };
    if (allowedDivIds !== null) {
      const allDepts = await prisma.department.findMany({
        where: { divisionId: { in: allowedDivIds } },
        select: { id: true },
      });
      sceneWhere.departmentId = { in: allDepts.map(d => d.id) };
    }

    const allScenes = await prisma.scene.findMany({
      where: sceneWhere,
      select: {
        id: true, itemNo: true, sceneName: true, status: true, progress: true,
        departmentId: true, seedOwners: true,
        department: { select: { id: true, name: true, divisionId: true } },
        executionLogs: { orderBy: { logDate: 'desc' }, take: 1, select: { logDate: true, content: true, status: true } },
      },
    });

    // 組合回傳：場景 seedOwners 包含 manager 姓名才納入
    const result = managers.map(m => {
      let roles = [];
      try { roles = typeof m.roles === 'string' ? JSON.parse(m.roles) : m.roles; } catch {}

      // seedOwners 是逗號分隔字串，拆開後比對 manager 姓名
      const myScenes = allScenes.filter(s => {
        if (!s.seedOwners) return false;
        const owners = s.seedOwners.split(/[,，、]/).map(o => o.trim());
        return owners.includes(m.name);
      });

      return {
        id: m.id,
        name: m.name,
        roles,
        division: m.division,
        department: m.department,
        section: m.section,
        sceneStats: {
          total: myScenes.length,
          inProgress: myScenes.filter(s => s.status === '進行中').length,
          planning:   myScenes.filter(s => s.status === '規劃中').length,
          completed:  myScenes.filter(s => s.status === '已完成').length,
        },
        scenes: myScenes.map(s => ({
          id: s.id,
          itemNo: s.itemNo,
          sceneName: s.sceneName,
          status: s.status,
          progress: s.progress,
          latestLog: s.executionLogs[0] || null,
        })),
      };
    });

    res.json(result.filter(r => r.scenes.length > 0));
  } catch (err) {
    res.status(500).json({ error: '取得種子負責人追蹤失敗：' + err.message });
  }
};

// GET /api/leader-tracking/:userId/scenes
// 取得特定種子負責人的完整場景清單（含最新執行日誌）
exports.getLeaderScenes = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const allowedDivIds = await getAllowedDivisionIds(req.user);

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { division: true, department: true, section: true },
    });
    if (!targetUser) return res.status(404).json({ error: '使用者不存在' });

    // 權限檢查：manager 只能查自己本部的人
    if (allowedDivIds !== null) {
      if (!allowedDivIds.includes(targetUser.divisionId)) {
        return res.status(403).json({ error: '無權查看此種子負責人' });
      }
    }

    let roles = [];
    try { roles = typeof targetUser.roles === 'string' ? JSON.parse(targetUser.roles) : targetUser.roles; } catch {}
    if (!roles.includes('manager')) return res.status(400).json({ error: '此使用者非種子負責人' });

    // 找該本部的所有場景
    const depts = targetUser.divisionId
      ? await prisma.department.findMany({ where: { divisionId: targetUser.divisionId }, select: { id: true } })
      : [];
    const deptIds = depts.map(d => d.id);

    const scenes = await prisma.scene.findMany({
      where: { active: true, departmentId: { in: deptIds } },
      include: {
        department: { select: { id: true, name: true, divisionId: true } },
        section: { select: { id: true, name: true } },
        executionLogs: { orderBy: { logDate: 'desc' }, take: 5, select: { id: true, logDate: true, content: true, status: true, note: true, executor: true } },
        actualSavings: { orderBy: { year: 'desc' }, take: 1 },
      },
      orderBy: { itemNo: 'asc' },
    });

    res.json({
      leader: {
        id: targetUser.id,
        name: targetUser.name,
        division: targetUser.division,
        department: targetUser.department,
        section: targetUser.section,
      },
      scenes,
    });
  } catch (err) {
    res.status(500).json({ error: '取得場景清單失敗：' + err.message });
  }
};
