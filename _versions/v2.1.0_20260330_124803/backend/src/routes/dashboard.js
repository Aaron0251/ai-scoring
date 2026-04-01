const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── 輔助：KPI 統計 ────────────────────────────
async function getKpiStats() {
  const [totalScenes, completedScenes, inProgressScenes, configs] = await Promise.all([
    prisma.scene.count({ where: { active: true } }),
    prisma.scene.count({ where: { active: true, status: '已完成' } }),
    prisma.scene.count({ where: { active: true, status: '進行中' } }),
    prisma.systemConfig.findMany(),
  ]);

  const configMap = {};
  for (const c of configs) configMap[c.key] = c.value;

  // 累計省時計算
  const timeSums = await prisma.scene.aggregate({
    where: { active: true },
    _sum: { timeSavedHours: true, actualTimeSavedHours: true },
  });

  return {
    totalScenes,
    completedScenes,
    inProgressScenes,
    plannedScenes: totalScenes - completedScenes - inProgressScenes,
    targetScenes: parseInt(configMap.target_scenes || '100'),
    estimatedTimeSaved: timeSums._sum.timeSavedHours || 0,
    actualTimeSaved: timeSums._sum.actualTimeSavedHours || 0,
    targetHours: parseInt(configMap.target_hours || '10000'),
    completionRate: totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0,
  };
}

// GET /api/dashboard
router.get('/', authenticate, async (req, res) => {
  const kpi = await getKpiStats();

  // 部門分布
  const deptStats = await prisma.department.findMany({
    include: {
      division: true,
      scenes: {
        where: { active: true },
        select: { status: true, timeSavedHours: true, actualTimeSavedHours: true },
      },
    },
  });

  const departments = deptStats.map(d => ({
    id: d.id,
    name: d.name,
    division: d.division?.name,
    total: d.scenes.length,
    completed: d.scenes.filter(s => s.status === '已完成').length,
    inProgress: d.scenes.filter(s => s.status === '進行中').length,
    timeSaved: d.scenes.reduce((sum, s) => sum + (s.timeSavedHours || 0), 0),
    actualTimeSaved: d.scenes.reduce((sum, s) => sum + (s.actualTimeSavedHours || 0), 0),
  }));

  res.json({ kpi, departments });
});

// GET /api/dashboard/drilldown?level=division|department|section&id=X
router.get('/drilldown', authenticate, async (req, res) => {
  const { level, id } = req.query;

  if (level === 'division') {
    // 往下一層：列出該本部底下的部門
    const divId = parseInt(id);
    const departments = await prisma.department.findMany({
      where: { divisionId: divId },
      include: {
        scenes: { where: { active: true }, select: { status: true, timeSavedHours: true, actualTimeSavedHours: true } },
      },
    });
    res.json(departments.map(d => ({
      id: d.id, name: d.name, type: 'department',
      total: d.scenes.length,
      completed: d.scenes.filter(s => s.status === '已完成').length,
      inProgress: d.scenes.filter(s => s.status === '進行中').length,
      timeSaved: d.scenes.reduce((s, x) => s + (x.timeSavedHours || 0), 0),
    })));

  } else if (level === 'department') {
    // 往下一層：列出該部門底下的課級
    const deptId = parseInt(id);
    const sections = await prisma.section.findMany({
      where: { departmentId: deptId },
      include: {
        scenes: { where: { active: true }, select: { status: true, timeSavedHours: true } },
      },
    });
    res.json(sections.map(s => ({
      id: s.id, name: s.name, type: 'section',
      total: s.scenes.length,
      completed: s.scenes.filter(x => x.status === '已完成').length,
      inProgress: s.scenes.filter(x => x.status === '進行中').length,
      timeSaved: s.scenes.reduce((acc, x) => acc + (x.timeSavedHours || 0), 0),
    })));

  } else if (level === 'section') {
    // 底層：列出場景清單
    const sectionId = parseInt(id);
    const scenes = await prisma.scene.findMany({
      where: { sectionId, active: true },
      orderBy: { itemNo: 'asc' },
      select: {
        id: true, itemNo: true, sceneName: true, status: true,
        priority: true, progress: true, timeSavedHours: true,
      },
    });
    res.json(scenes);
  } else {
    res.status(400).json({ error: '參數 level 必須是 division | department | section' });
  }
});

// GET /api/dashboard/execution-table
// 推動執行狀態階層表
router.get('/execution-table', authenticate, async (req, res) => {
  const divisions = await prisma.division.findMany({
    include: {
      departments: {
        include: {
          sections: {
            include: {
              scenes: {
                where: { active: true },
                select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, timeSavedHours: true, priority: true },
              },
            },
          },
          scenes: {
            where: { active: true, sectionId: null }, // 部門直屬場景（無課級）
            select: { id: true, itemNo: true, sceneName: true, status: true, progress: true, timeSavedHours: true, priority: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(divisions);
});

module.exports = router;
