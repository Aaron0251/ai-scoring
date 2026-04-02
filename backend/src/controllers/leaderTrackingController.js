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
// 從場景的 seedOwners 欄位取出所有種子負責人，依姓名分組
exports.getLeaders = async (req, res) => {
  try {
    const allowedDivIds = await getAllowedDivisionIds(req.user);

    // 依權限取得場景
    let sceneWhere = { active: true };
    if (allowedDivIds !== null) {
      if (allowedDivIds.length === 0) return res.json([]);
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
        seedOwners: true,
        department: { select: { id: true, name: true, division: { select: { id: true, name: true } } } },
        executionLogs: { orderBy: { logDate: 'desc' }, take: 1, select: { logDate: true, content: true, status: true } },
      },
    });

    // 以 seedOwners 欄位分組（逗號/頓號分隔）
    const leaderMap = new Map(); // name -> { scenes, division? }

    for (const scene of allScenes) {
      if (!scene.seedOwners) continue;
      const owners = scene.seedOwners.split(/[,，、]/).map(o => o.trim()).filter(Boolean);
      for (const ownerName of owners) {
        if (!leaderMap.has(ownerName)) {
          leaderMap.set(ownerName, {
            name: ownerName,
            division: scene.department?.division || null,
            department: scene.department || null,
            scenes: [],
          });
        }
        leaderMap.get(ownerName).scenes.push({
          id: scene.id,
          itemNo: scene.itemNo,
          sceneName: scene.sceneName,
          status: scene.status,
          progress: scene.progress,
          latestLog: scene.executionLogs[0] || null,
        });
      }
    }

    // 轉成陣列並加上統計
    const result = [...leaderMap.values()].map(l => ({
      id: null, // 非系統使用者，無 id
      name: l.name,
      division: l.division,
      department: l.department,
      sceneStats: {
        total: l.scenes.length,
        inProgress: l.scenes.filter(s => s.status === '進行中').length,
        planning:   l.scenes.filter(s => s.status === '規劃中').length,
        completed:  l.scenes.filter(s => s.status === '已完成').length,
      },
      scenes: l.scenes,
    }));

    // 依本部名排序
    result.sort((a, b) => (a.division?.name || '').localeCompare(b.division?.name || '', 'zh-TW') || a.name.localeCompare(b.name, 'zh-TW'));

    res.json(result);
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
