const prisma = require('../prisma');

exports.getStats = async (req, res) => {
  try {
    const [kpi, divisions, pieData, efficiencyGains, top5, departmentDist, alertList, toolTreemap] = await Promise.all([
      getKpiStats(),
      getDivisionStats(),
      getDevelopMethodPie(),
      getEfficiencyGains(),
      getTop5Scenes(),
      getDepartmentDistribution(),
      getAlertList(),
      getToolTreemap(),
    ]);
    res.json({ kpi, divisions, pieData, efficiencyGains, top5, departmentDist, alertList, toolTreemap });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

// 舊的 getStats（保留供相容）
exports.getStatsLegacy = async (req, res) => {
  const kpi = await getKpiStats();

  // 各本部合計執行狀況
  const divisionStats = await prisma.division.findMany({
    include: {
      departments: {
        include: {
          scenes: {
            where: { active: true, status: { not: '暫定' } },
            select: { status: true, originalHours: true, improvedHours: true, goLiveDate: true, originalHeadcount: true, improvedHeadcount: true, actualSavings: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const divisions = divisionStats.map(div => {
    const allScenes = div.departments.flatMap(d => d.scenes);
    const completedWithLive = allScenes.filter(s => s.status === '已完成' && s.goLiveDate);
    const actualSavingsTotal = completedWithLive.flatMap(s => s.actualSavings).reduce((sum, a) => {
      return sum + [a.m1,a.m2,a.m3,a.m4,a.m5,a.m6,a.m7,a.m8,a.m9,a.m10,a.m11,a.m12].reduce((s,v) => s+(v||0), 0);
    }, 0);
    const headcountSaved = completedWithLive.reduce((sum, s) => sum + ((s.originalHeadcount||0) - (s.improvedHeadcount||0)), 0);
    return {
      name: div.name,
      total: allScenes.length,
      completed: allScenes.filter(s => s.status === '已完成').length,
      inProgress: allScenes.filter(s => s.status === '進行中').length,
      estimatedSaved: allScenes.reduce((sum, s) => sum + ((s.originalHours||0) - (s.improvedHours||0)), 0),
      actualSavingsTotal,
      headcountSaved,
    };
  });

  // 開發方式圓餅圖
  const methodCounts = await prisma.scene.groupBy({
    by: ['developMethod'],
    where: { active: true },
    _count: { id: true },
  });
  const pieData = methodCounts
    .filter(m => m.developMethod)
    .map(m => ({ name: m.developMethod, value: m._count.id }));

  res.json({ kpi, divisions, pieData });
};

exports.drilldown = async (req, res) => {
  const { level, id } = req.query;

  if (level === 'division') {
    const departments = await prisma.department.findMany({
      where: { divisionId: parseInt(id) },
      include: { scenes: { where: { active: true }, select: { status: true, originalHours: true, improvedHours: true } } },
    });
    return res.json(departments.map(d => ({
      id: d.id, name: d.name, type: 'department',
      total: d.scenes.length,
      completed: d.scenes.filter(s => s.status === '已完成').length,
      inProgress: d.scenes.filter(s => s.status === '進行中').length,
      timeSaved: d.scenes.reduce((s, x) => s + ((x.originalHours || 0) - (x.improvedHours || 0)), 0),
    })));
  }

  if (level === 'department') {
    const sections = await prisma.section.findMany({
      where: { departmentId: parseInt(id) },
      include: { scenes: { where: { active: true }, select: { status: true, originalHours: true, improvedHours: true } } },
    });
    return res.json(sections.map(s => ({
      id: s.id, name: s.name, type: 'section',
      total: s.scenes.length,
      completed: s.scenes.filter(x => x.status === '已完成').length,
      inProgress: s.scenes.filter(x => x.status === '進行中').length,
      timeSaved: s.scenes.reduce((acc, x) => acc + ((x.originalHours || 0) - (x.improvedHours || 0)), 0),
    })));
  }

  if (level === 'section') {
    const scenes = await prisma.scene.findMany({
      where: { sectionId: parseInt(id), active: true },
      orderBy: { itemNo: 'asc' },
      select: { id: true, itemNo: true, sceneName: true, status: true, priority: true, progress: true, originalHours: true, improvedHours: true },
    });
    return res.json(scenes);
  }

  res.status(400).json({ error: '參數 level 必須是 division | department | section' });
};

exports.executionTable = async (req, res) => {
  const divisions = await prisma.division.findMany({
    include: {
      departments: {
        include: {
          sections: {
            include: {
              scenes: {
                where: { active: true },
                select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, originalHours: true, improvedHours: true, priority: true },
              },
            },
          },
          scenes: {
            where: { active: true, sectionId: null },
            select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, originalHours: true, improvedHours: true, priority: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.json(divisions);
};

// ── 內部輔助 ──────────────────────────────────────────────

async function getDivisionStats() {
  const divisionStats = await prisma.division.findMany({
    include: {
      departments: {
        include: {
          scenes: {
            where: { active: true, status: { not: '暫定' } },
            select: { status: true, originalHours: true, improvedHours: true, goLiveDate: true, originalHeadcount: true, improvedHeadcount: true, actualSavings: true, progress: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  return divisionStats.map(div => {
    const allScenes = div.departments.flatMap(d => d.scenes);
    const completedWithLive = allScenes.filter(s => s.status === '已完成' && s.goLiveDate);
    const actualSavingsTotal = completedWithLive.flatMap(s => s.actualSavings).reduce((sum, a) => {
      return sum + [a.m1,a.m2,a.m3,a.m4,a.m5,a.m6,a.m7,a.m8,a.m9,a.m10,a.m11,a.m12].reduce((s,v) => s+(v||0), 0);
    }, 0);
    const headcountSaved = completedWithLive.reduce((sum, s) => sum + ((s.originalHeadcount||0) - (s.improvedHeadcount||0)), 0);
    const avgProgress = allScenes.length > 0 ? Math.round(allScenes.reduce((s, x) => s + (x.progress || 0), 0) / allScenes.length) : 0;
    return {
      name: div.name,
      total: allScenes.length,
      completed: allScenes.filter(s => s.status === '已完成').length,
      inProgress: allScenes.filter(s => s.status === '進行中').length,
      planned: allScenes.filter(s => s.status === '規劃中').length,
      estimatedSaved: allScenes.reduce((sum, s) => sum + ((s.originalHours||0) - (s.improvedHours||0)), 0),
      actualSavingsTotal,
      headcountSaved,
      avgProgress,
    };
  });
}

async function getDevelopMethodPie() {
  const methodCounts = await prisma.scene.groupBy({
    by: ['developMethod'],
    where: { active: true, status: { not: '暫定' } },
    _count: { id: true },
  });
  return methodCounts.filter(m => m.developMethod).map(m => ({ name: m.developMethod, value: m._count.id }));
}

async function getEfficiencyGains() {
  const scenes = await prisma.scene.findMany({
    where: { active: true, status: { not: '暫定' } },
    select: { id: true, itemNo: true, sceneName: true, originalHours: true, improvedHours: true, originalHeadcount: true, improvedHeadcount: true, priority: true, progress: true },
    orderBy: { itemNo: 'asc' },
    take: 30,
  });
  return scenes.map(s => ({
    id: s.id,
    name: s.sceneName || s.itemNo,
    itemNo: s.itemNo,
    originalHours: s.originalHours || 0,
    improvedHours: s.improvedHours || 0,
    savedHours: (s.originalHours || 0) - (s.improvedHours || 0),
    originalHeadcount: s.originalHeadcount || 0,
    improvedHeadcount: s.improvedHeadcount || 0,
    savedHeadcount: (s.originalHeadcount || 0) - (s.improvedHeadcount || 0),
    priority: s.priority,
    progress: s.progress || 0,
  }));
}

async function getTop5Scenes() {
  const scenes = await prisma.scene.findMany({
    where: { active: true, status: { not: '暫定' } },
    select: { id: true, itemNo: true, sceneName: true, originalHours: true, improvedHours: true, originalHeadcount: true, improvedHeadcount: true, status: true, priority: true, progress: true },
    orderBy: [{ originalHours: 'desc' }],
  });
  return scenes
    .map(s => ({
      id: s.id,
      itemNo: s.itemNo,
      name: s.sceneName || s.itemNo,
      savedHours: (s.originalHours || 0) - (s.improvedHours || 0),
      savedHeadcount: (s.originalHeadcount || 0) - (s.improvedHeadcount || 0),
      status: s.status,
      priority: s.priority,
      progress: s.progress || 0,
    }))
    .sort((a, b) => b.savedHours - a.savedHours)
    .slice(0, 5);
}

async function getDepartmentDistribution() {
  const divisions = await prisma.division.findMany({
    include: {
      departments: {
        include: {
          scenes: {
            where: { active: true, status: { not: '暫定' } },
            select: { status: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  const result = [];
  for (const div of divisions) {
    for (const dept of div.departments) {
      if (dept.scenes.length === 0) continue;
      result.push({
        division: div.name,
        department: dept.name,
        total: dept.scenes.length,
        completed: dept.scenes.filter(s => s.status === '已完成').length,
        inProgress: dept.scenes.filter(s => s.status === '進行中').length,
        planned: dept.scenes.filter(s => s.status === '規劃中').length,
      });
    }
  }
  return result;
}

async function getAlertList() {
  const scenes = await prisma.scene.findMany({
    where: {
      active: true,
      status: { not: '暫定' },
      OR: [
        { progress: { lt: 30 }, status: '進行中' },
        { note: { contains: 'IT' } },
        { note: { contains: 'API' } },
        { note: { contains: '協助' } },
      ],
    },
    select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, note: true, priority: true, targetDate: true },
    orderBy: { priority: 'asc' },
    take: 20,
  });
  return scenes.map(s => ({
    id: s.id,
    itemNo: s.itemNo,
    name: s.sceneName || s.itemNo,
    status: s.status,
    progress: s.progress || 0,
    note: s.note,
    priority: s.priority,
    targetDate: s.targetDate,
    reason: s.progress < 30 && s.status === '進行中' ? '進度落後' : '需IT協助',
  }));
}

async function getToolTreemap() {
  const scenes = await prisma.scene.findMany({
    where: { active: true, status: { not: '暫定' }, developToolDesc: { not: null } },
    select: { developToolDesc: true },
  });
  const toolCount = {};
  for (const s of scenes) {
    if (!s.developToolDesc) continue;
    const tools = [...new Set(s.developToolDesc.split(/[,，、]+/).map(t => t.trim()).filter(Boolean))];
    for (const tool of tools) {
      toolCount[tool] = (toolCount[tool] || 0) + 1;
    }
  }
  return Object.entries(toolCount)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

async function getKpiStats() {
  const [totalScenes, completedScenes, inProgressScenes, configs] = await Promise.all([
    prisma.scene.count({ where: { active: true } }),
    prisma.scene.count({ where: { active: true, status: '已完成' } }),
    prisma.scene.count({ where: { active: true, status: '進行中' } }),
    prisma.systemConfig.findMany(),
  ]);

  const configMap = {};
  for (const c of configs) configMap[c.key] = c.value;

  const timeSums = await prisma.scene.aggregate({
    where: { active: true },
    _sum: { originalHours: true, improvedHours: true },
  });

  // 成效：狀態=已完成 且 有上線日期
  const effectiveScenes = await prisma.scene.findMany({
    where: { active: true, status: '已完成', goLiveDate: { not: null } },
    select: { originalHeadcount: true, improvedHeadcount: true, actualSavings: true },
  });

  const effectiveCount = effectiveScenes.length;
  const actualTimeSavedTotal = effectiveScenes.flatMap(s => s.actualSavings).reduce((sum, a) => {
    return sum + [a.m1,a.m2,a.m3,a.m4,a.m5,a.m6,a.m7,a.m8,a.m9,a.m10,a.m11,a.m12].reduce((s,v) => s+(v||0), 0);
  }, 0);
  const headcountSaved = effectiveScenes.reduce((sum, s) => sum + ((s.originalHeadcount||0) - (s.improvedHeadcount||0)), 0);

  return {
    totalScenes,
    completedScenes,
    inProgressScenes,
    plannedScenes: totalScenes - completedScenes - inProgressScenes,
    targetScenes: parseInt(configMap.target_scenes || '100'),
    targetHours: parseInt(configMap.target_hours || '10000'),
    estimatedTimeSaved: (timeSums._sum.originalHours || 0) - (timeSums._sum.improvedHours || 0),
    completionRate: totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0,
    // 成效區（完成+有上線日期）
    effectiveCount,
    actualTimeSavedTotal,
    headcountSaved,
  };
}
