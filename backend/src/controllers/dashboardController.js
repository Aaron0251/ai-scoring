const prisma = require('../prisma');
const { getAccessibleDeptIds } = require('../utils/accessControl');

const MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// ── 115年（2026）年化計算輔助 ────────────────────────────────
const YEAR_115_START = new Date('2026-01-01T00:00:00');
const YEAR_115_END   = new Date('2026-12-31T23:59:59');

/** 計算 fromDate 到 115年底之間的月數（最大12，最小0） */
function monthsIn115(fromDate) {
  const start = fromDate < YEAR_115_START ? YEAR_115_START : fromDate;
  if (start > YEAR_115_END) return 0;
  const diffMs = YEAR_115_END.getTime() - start.getTime();
  return diffMs / (1000 * 60 * 60 * 24 * 30.4375); // 平均每月天數
}

/** 取場景的月均節省時數 */
function sceneMonthly(s) {
  if (s.savingHoursMonthly != null) return s.savingHoursMonthly;
  return Math.max(0, (s.originalHours || 0) - (s.improvedHours || 0));
}

/** 每月標準工時（21工作天 × 8h） */
const MONTHLY_HOURS_PER_PERSON = 168;

/**
 * 取場景的節省人數
 * - 有填 originalHeadcount 或 improvedHeadcount 任一欄 → 直接用差值（即使差為 0 也尊重）
 * - 兩欄都沒填 + 有 savingHoursMonthly → 用 ÷168 換算
 */
function sceneHeadcountSaved(s) {
  // 只要有填人數欄位（非 null），就直接用差值，不做 fallback
  if (s.originalHeadcount != null || s.improvedHeadcount != null) {
    return Math.max(0, (s.originalHeadcount || 0) - (s.improvedHeadcount || 0));
  }
  // 兩個人數欄位都沒填，改用 savingHoursMonthly ÷ 168 換算
  if (s.savingHoursMonthly != null && s.savingHoursMonthly > 0) {
    return s.savingHoursMonthly / MONTHLY_HOURS_PER_PERSON;
  }
  return 0;
}

function sumActualSavings(actualSavings) {
  return actualSavings.reduce((total, a) => {
    return total + MONTH_KEYS.reduce((s, k) => s + (a[k] || 0), 0);
  }, 0);
}

/** 將 allowedDeptIds 轉為 Prisma scene WHERE 片段 */
function sceneWhereByAccess(allowedDeptIds, extra = {}) {
  const base = { ...extra };
  if (allowedDeptIds !== null) base.departmentId = { in: allowedDeptIds };
  return base;
}

exports.getStats = async (req, res) => {
  try {
    let allowedDeptIds = await getAccessibleDeptIds(req.user);

    // admin / executive 可透過 divisionId query 縮小範圍
    const { divisionId } = req.query;
    if (divisionId) {
      const divDepts = await prisma.department.findMany({
        where: { divisionId: parseInt(divisionId) },
        select: { id: true },
      });
      const divDeptIds = divDepts.map(d => d.id);
      // 與使用者本身的存取範圍取交集
      allowedDeptIds = allowedDeptIds !== null
        ? divDeptIds.filter(id => allowedDeptIds.includes(id))
        : divDeptIds;
    }

    const [kpi, divisions, pieData, efficiencyGains, top5, departmentDist, alertList, toolTreemap] = await Promise.all([
      getKpiStats(allowedDeptIds),
      getDivisionStats(allowedDeptIds),
      getDevelopMethodPie(allowedDeptIds),
      getEfficiencyGains(allowedDeptIds),
      getTop5Scenes(allowedDeptIds),
      getDepartmentDistribution(allowedDeptIds),
      getAlertList(allowedDeptIds),
      getToolTreemap(allowedDeptIds),
    ]);
    res.json({ kpi, divisions, pieData, efficiencyGains, top5, departmentDist, alertList, toolTreemap });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

// 舊的 getStats（保留供相容）
exports.getStatsLegacy = async (req, res) => {
  const allowedDeptIds = await getAccessibleDeptIds(req.user);
  const kpi = await getKpiStats(allowedDeptIds);

  // 各本部合計執行狀況
  const deptWhere = allowedDeptIds !== null ? { id: { in: allowedDeptIds } } : {};
  const divisionStats = await prisma.division.findMany({
    include: {
      departments: {
        where: deptWhere,
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

  const divisions = divisionStats
    .filter(div => div.departments.length > 0)
    .map(div => {
      const allScenes = div.departments.flatMap(d => d.scenes);
      const completedWithLive = allScenes.filter(s => s.status === '已完成' && s.goLiveDate);
      const actualSavingsTotal = sumActualSavings(completedWithLive.flatMap(s => s.actualSavings));
      const headcountSaved = completedWithLive.reduce((sum, s) => sum + sceneHeadcountSaved(s), 0);
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
    where: sceneWhereByAccess(allowedDeptIds, { active: true }),
    _count: { id: true },
  });
  const pieData = methodCounts
    .filter(m => m.developMethod)
    .map(m => ({ name: m.developMethod, value: m._count.id }));

  res.json({ kpi, divisions, pieData });
};

exports.drilldown = async (req, res) => {
  const { level, id } = req.query;
  const allowedDeptIds = await getAccessibleDeptIds(req.user);

  if (level === 'division') {
    const deptWhere = { divisionId: parseInt(id) };
    if (allowedDeptIds !== null) deptWhere.id = { in: allowedDeptIds };
    const departments = await prisma.department.findMany({
      where: deptWhere,
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
    // Check access
    if (allowedDeptIds !== null && !allowedDeptIds.includes(parseInt(id))) {
      return res.status(403).json({ error: '無權存取此部門' });
    }
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
      where: sceneWhereByAccess(allowedDeptIds, { sectionId: parseInt(id), active: true }),
      orderBy: { itemNo: 'asc' },
      select: { id: true, itemNo: true, sceneName: true, status: true, priority: true, progress: true, originalHours: true, improvedHours: true },
    });
    return res.json(scenes);
  }

  res.status(400).json({ error: '參數 level 必須是 division | department | section' });
};

exports.executionTable = async (req, res) => {
  const allowedDeptIds = await getAccessibleDeptIds(req.user);
  const deptWhere = allowedDeptIds !== null ? { id: { in: allowedDeptIds } } : {};

  const divisions = await prisma.division.findMany({
    include: {
      departments: {
        where: deptWhere,
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
  // 過濾掉無部門可顯示的本部
  res.json(divisions.filter(div => div.departments.length > 0));
};

// ── 內部輔助 ──────────────────────────────────────────────

async function getDivisionStats(allowedDeptIds) {
  const deptWhere = allowedDeptIds !== null ? { id: { in: allowedDeptIds } } : {};
  const divisionStats = await prisma.division.findMany({
    include: {
      departments: {
        where: deptWhere,
        include: {
          scenes: {
            where: { active: true, status: { not: '暫定' } },
            select: { status: true, originalHours: true, improvedHours: true, savingHoursMonthly: true, goLiveDate: true, progress: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  const today = new Date();
  return divisionStats
    .filter(div => div.departments.length > 0)
    .map(div => {
      const allScenes = div.departments.flatMap(d => d.scenes);
      const completedWithLive = allScenes.filter(s => s.status === '已完成' && s.goLiveDate);
      const onlineSavingHoursSum = completedWithLive.reduce((sum, s) => sum + (s.savingHoursMonthly || 0), 0);
      // 實際節省(h)：已上線場景的 savingHoursMonthly 加總
      const actualSavingsTotal = onlineSavingHoursSum;
      // 節省人數：已上線場景的 savingHoursMonthly 加總 ÷ 168
      const headcountSaved = Math.round(onlineSavingHoursSum / MONTHLY_HOURS_PER_PERSON * 10) / 10;
      const avgProgress = allScenes.length > 0 ? Math.round(allScenes.reduce((s, x) => s + (x.progress || 0), 0) / allScenes.length) : 0;
      const estimatedSaved = allScenes.reduce((sum, s) => {
        const monthly = sceneMonthly(s);
        if (monthly <= 0) return sum;
        const refDate = s.goLiveDate ? new Date(s.goLiveDate) : today;
        return sum + monthly * monthsIn115(refDate);
      }, 0);
      return {
        name: div.name,
        total: allScenes.length,
        completed: allScenes.filter(s => s.status === '已完成').length,
        inProgress: allScenes.filter(s => s.status === '進行中').length,
        planned: allScenes.filter(s => s.status === '規劃中').length,
        estimatedSaved,
        actualSavingsTotal,
        headcountSaved,
        avgProgress,
      };
    });
}

async function getDevelopMethodPie(allowedDeptIds) {
  const methodCounts = await prisma.scene.groupBy({
    by: ['developMethod'],
    where: sceneWhereByAccess(allowedDeptIds, { active: true, status: { not: '暫定' } }),
    _count: { id: true },
  });
  return methodCounts.filter(m => m.developMethod).map(m => ({ name: m.developMethod, value: m._count.id }));
}

async function getEfficiencyGains(allowedDeptIds) {
  const scenes = await prisma.scene.findMany({
    where: sceneWhereByAccess(allowedDeptIds, { active: true, status: { not: '暫定' } }),
    select: { id: true, itemNo: true, sceneName: true, originalHours: true, improvedHours: true, savingHoursMonthly: true, originalHeadcount: true, improvedHeadcount: true, priority: true, progress: true },
    orderBy: { itemNo: 'asc' },
    take: 30,
  });
  return scenes.map(s => ({
    id: s.id,
    name: s.sceneName || s.itemNo,
    itemNo: s.itemNo,
    originalHours: s.originalHours || 0,
    improvedHours: s.improvedHours || 0,
    savingHoursMonthly: s.savingHoursMonthly,   // 直接填入的預估節省時數
    savedHours: sceneMonthly(s),                 // 優先用 savingHoursMonthly，再 fallback 到差值
    originalHeadcount: s.originalHeadcount || 0,
    improvedHeadcount: s.improvedHeadcount || 0,
    savedHeadcount: sceneHeadcountSaved(s),
    priority: s.priority,
    progress: s.progress || 0,
  }));
}

async function getTop5Scenes(allowedDeptIds) {
  const scenes = await prisma.scene.findMany({
    where: sceneWhereByAccess(allowedDeptIds, { active: true, status: { not: '暫定' } }),
    select: { id: true, itemNo: true, sceneName: true, originalHours: true, improvedHours: true, savingHoursMonthly: true, originalHeadcount: true, improvedHeadcount: true, status: true, priority: true, progress: true },
    take: 50,
  });
  return scenes
    .map(s => ({
      id: s.id,
      itemNo: s.itemNo,
      name: s.sceneName || s.itemNo,
      savedHours: sceneMonthly(s),   // 優先用 savingHoursMonthly
      savedHeadcount: sceneHeadcountSaved(s),
      status: s.status,
      priority: s.priority,
      progress: s.progress || 0,
    }))
    .sort((a, b) => b.savedHours - a.savedHours)
    .slice(0, 5);
}

async function getDepartmentDistribution(allowedDeptIds) {
  const deptWhere = allowedDeptIds !== null ? { id: { in: allowedDeptIds } } : {};
  const divisions = await prisma.division.findMany({
    include: {
      departments: {
        where: deptWhere,
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

async function getAlertList(allowedDeptIds) {
  const scenes = await prisma.scene.findMany({
    where: {
      ...sceneWhereByAccess(allowedDeptIds),
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

async function getToolTreemap(allowedDeptIds) {
  const scenes = await prisma.scene.findMany({
    where: sceneWhereByAccess(allowedDeptIds, { active: true, status: { not: '暫定' }, developToolDesc: { not: null } }),
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

async function getKpiStats(allowedDeptIds) {
  const sceneWhere = sceneWhereByAccess(allowedDeptIds, { active: true });

  const [totalScenes, completedScenes, inProgressScenes, configs] = await Promise.all([
    prisma.scene.count({ where: sceneWhere }),
    prisma.scene.count({ where: { ...sceneWhere, status: '已完成' } }),
    prisma.scene.count({ where: { ...sceneWhere, status: '進行中' } }),
    prisma.systemConfig.findMany(),
  ]);

  const configMap = {};
  for (const c of configs) configMap[c.key] = c.value;

  // 年化節省時數 + 平均進度 + 人力計算（全部場景一次查，避免多次 roundtrip）
  const allScenesForSaving = await prisma.scene.findMany({
    where: sceneWhere,
    select: { originalHours: true, improvedHours: true, savingHoursMonthly: true, goLiveDate: true, progress: true, status: true, maintainOrDevelop: true },
  });
  const today = new Date();

  // 平均進度：所有場景直接平均
  const avgProgress = allScenesForSaving.length > 0
    ? Math.round(allScenesForSaving.reduce((s, x) => s + (x.progress || 0), 0) / allScenesForSaving.length)
    : 0;

  // 預估月均：所有場景月均節省時數加總
  const estimatedTimeSaved = allScenesForSaving.reduce((sum, s) => sum + sceneMonthly(s), 0);

  // 實際月均：僅已上線（有 goLiveDate）場景的月均加總
  const actualMonthlyAvg = allScenesForSaving
    .filter(s => s.goLiveDate != null)
    .reduce((sum, s) => sum + sceneMonthly(s), 0);

  // 115年年化節省時數
  const annualizedSaved115 = allScenesForSaving.reduce((sum, s) => {
    const monthly = sceneMonthly(s);
    if (monthly <= 0) return sum;
    const refDate = s.goLiveDate ? new Date(s.goLiveDate) : today;
    return sum + monthly * monthsIn115(refDate);
  }, 0);

  // 成效：狀態=已完成 且 有上線日期
  const effectiveScenes = await prisma.scene.findMany({
    where: { ...sceneWhere, status: '已完成', goLiveDate: { not: null } },
    select: { savingHoursMonthly: true, actualSavings: true },
  });

  const effectiveCount = effectiveScenes.length;
  const actualTimeSavedTotal = sumActualSavings(effectiveScenes.flatMap(s => s.actualSavings));

  // ── 人力釋放率（新邏輯）────────────────────────────────────
  // 分子：已上線（已完成 + goLiveDate）的 savingHoursMonthly 加總
  const onlineSavingHoursSum = allScenesForSaving
    .filter(s => s.status === '已完成' && s.goLiveDate)
    .reduce((sum, s) => sum + (s.savingHoursMonthly || 0), 0);

  // 分母：全部場景排除「暫停」和「作廢」的 savingHoursMonthly 加總
  const baseSavingHoursSum = allScenesForSaving
    .filter(s => s.status !== '暫停' && s.maintainOrDevelop !== '作廢')
    .reduce((sum, s) => sum + (s.savingHoursMonthly || 0), 0);

  // 節省人數 = 分子 ÷ 168
  const headcountSaved = Math.round(onlineSavingHoursSum / MONTHLY_HOURS_PER_PERSON * 10) / 10;

  // 前端以 headcountSaved / totalHeadcountBase 計算 %，故分母也除以 168 保持單位一致
  const totalHeadcountBase = baseSavingHoursSum / MONTHLY_HOURS_PER_PERSON;

  return {
    totalScenes,
    completedScenes,
    inProgressScenes,
    plannedScenes: totalScenes - completedScenes - inProgressScenes,
    targetScenes: parseInt(configMap.target_scenes || '100'),
    targetHours: parseInt(configMap.target_hours || '10000'),
    avgProgress,
    estimatedTimeSaved,
    actualMonthlyAvg,
    annualizedSaved115,
    completionRate: totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0,
    effectiveCount,
    actualTimeSavedTotal,
    headcountSaved,
    totalHeadcountBase,
  };
}
