const prisma = require('../prisma');
const { getAccessibleDeptIds } = require('../utils/accessControl');

function getWeekRange(weekStartDate) {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const prevWeekStart = new Date(start);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(start);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  return { currentStart: start, currentEnd: end, prevStart: prevWeekStart, prevEnd: prevWeekEnd };
}

function formatDate(date) {
  return date.toISOString().substring(0, 10);
}

async function getScenesWithFilter(divisionId, departmentId, sectionId) {
  const where = { active: true, status: { not: '暫停' }, maintainOrDevelop: { not: '作廢' } };
  if (sectionId) {
    where.sectionId = sectionId;
  } else if (departmentId) {
    where.departmentId = departmentId;
  } else if (divisionId) {
    where.department = { divisionId };
  }
  return prisma.scene.findMany({
    where,
    include: {
      department: { include: { division: true } },
      section: true,
      executionLogs: { orderBy: { logDate: 'desc' }, take: 1 },
    },
    orderBy: { itemNo: 'asc' },
  });
}

const YEAR_115_START = new Date('2026-01-01T00:00:00');
const YEAR_115_END   = new Date('2026-12-31T23:59:59');
function monthsIn115(fromDate) {
  const start = fromDate < YEAR_115_START ? YEAR_115_START : fromDate;
  if (start > YEAR_115_END) return 0;
  return (YEAR_115_END.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

function calculateSceneKPIs(scenes) {
  const totalScenes = scenes.length;
  const today = new Date();

  // 場景月均節省
  const sceneMonthly = s => s.savingHoursMonthly != null
    ? s.savingHoursMonthly
    : Math.max(0, (s.originalHours || 0) - (s.improvedHours || 0));

  // 115年年化節省時數（已上線依 goLiveDate，未上線依今天）
  const savingHours = scenes.reduce((sum, s) => {
    const monthly = sceneMonthly(s);
    if (monthly <= 0) return sum;
    const refDate = s.goLiveDate ? new Date(s.goLiveDate) : today;
    return sum + monthly * monthsIn115(refDate);
  }, 0);

  // 預估月均：所有場景月均加總
  const estimatedMonthlyAvg = scenes.reduce((sum, s) => sum + sceneMonthly(s), 0);

  // 實際月均：僅已上線（有 goLiveDate）場景月均加總
  const actualMonthlyAvg = scenes
    .filter(s => s.goLiveDate != null)
    .reduce((sum, s) => sum + sceneMonthly(s), 0);

  const avgProgress = scenes.length > 0
    ? Math.round(scenes.reduce((sum, s) => sum + (s.progress || 0), 0) / scenes.length)
    : 0;

  const MONTHLY_HOURS_PER_PERSON = 168;

  // ── 人力釋放率（新邏輯）────────────────────────────────────
  // 分子：已上線（已完成 + goLiveDate）的 savingHoursMonthly 加總
  const effectiveScenes = scenes.filter(s => s.status === '已完成' && s.goLiveDate);
  const onlineSavingHoursSum = effectiveScenes.reduce((sum, s) => sum + (s.savingHoursMonthly || 0), 0);

  // 分母：全部場景排除「暫停」和「作廢」的 savingHoursMonthly 加總
  const baseSavingHoursSum = scenes
    .filter(s => s.status !== '暫停' && s.maintainOrDevelop !== '作廢')
    .reduce((sum, s) => sum + (s.savingHoursMonthly || 0), 0);

  // 節省人數 = 分子 ÷ 168
  const headcountSaved = Math.round(onlineSavingHoursSum / MONTHLY_HOURS_PER_PERSON * 10) / 10;

  // 人力釋放率
  const humanReleaseRate = baseSavingHoursSum > 0
    ? Math.min(Math.round((onlineSavingHoursSum / baseSavingHoursSum) * 100), 100)
    : 0;

  return { totalScenes, savingHours, estimatedMonthlyAvg, actualMonthlyAvg, avgProgress, humanReleaseRate, headcountSaved };
}

/**
 * GET /api/weekly-tracking
 */
exports.getWeeklyTracking = async (req, res) => {
  try {
    const { division, department, section, week = formatDate(new Date()) } = req.query;
    let divisionId   = division   ? parseInt(division)   : null;
    let departmentId = department ? parseInt(department) : null;
    let sectionId    = section    ? parseInt(section)    : null;

    // ── 存取控制 ─────────────────────────────────────────────
    const allowedDeptIds = await getAccessibleDeptIds(req.user);

    if (allowedDeptIds !== null) {
      // 使用者有限制
      if (!divisionId && !departmentId && !sectionId) {
        // 未指定篩選 → 自動套用使用者所屬單位
        if (req.user.divisionId) {
          divisionId = req.user.divisionId;
        } else if (req.user.departmentId) {
          departmentId = req.user.departmentId;
        }
      } else {
        // 已指定篩選 → 驗證是否在允許範圍內
        if (departmentId && !allowedDeptIds.includes(departmentId)) {
          return res.status(403).json({ error: '無權查看該部門的數據' });
        }
        if (divisionId && req.user.divisionId && req.user.divisionId !== divisionId) {
          return res.status(403).json({ error: '無權查看其他本部的數據' });
        }
        if (departmentId && req.user.departmentId && req.user.departmentId !== departmentId && !req.user.divisionId) {
          return res.status(403).json({ error: '無權查看其他部門的數據' });
        }
      }
    }
    // allowedDeptIds === null → 無限制，沿用 query 篩選或無篩選（看全部）

    const { currentStart, currentEnd, prevStart, prevEnd } = getWeekRange(week);
    const threeWeeksAgo = new Date(currentStart);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 14);

    const scenes = await getScenesWithFilter(divisionId, departmentId, sectionId);
    const kpis = calculateSceneKPIs(scenes);

    // 本週進度變動：包含所有場景（含已完成），讓本週剛完成的也能顯示
    // 停滯預警：只看進行中/規劃中，排除已完成與暫停
    const stagnationScenes = scenes.filter(s => !['已完成', '暫停'].includes(s.status));

    if (scenes.length === 0) {
      return res.json({
        week: `${formatDate(currentStart)} ~ ${formatDate(currentEnd)}`,
        previousWeek: `${formatDate(prevStart)} ~ ${formatDate(prevEnd)}`,
        kpis, weeklyProgressItems: [], stagnatedScenes: [],
      });
    }

    // 一次性預載所有場景的進度歷史
    const sceneIds = scenes.map(s => s.id);
    const allHistories = await prisma.sceneProgressHistory.findMany({
      where: { sceneId: { in: sceneIds }, changedAt: { gte: threeWeeksAgo } },
      orderBy: { changedAt: 'desc' },
    });

    // 依 sceneId 分組（進度歷史）
    const historiesByScene = {};
    for (const h of allHistories) {
      if (!historiesByScene[h.sceneId]) historiesByScene[h.sceneId] = [];
      historiesByScene[h.sceneId].push(h);
    }

    // 一次性預載本週新增的執行日誌
    const currentWeekExecLogs = await prisma.sceneExecutionLog.findMany({
      where: { sceneId: { in: sceneIds }, createdAt: { gte: currentStart, lte: currentEnd } },
      orderBy: { createdAt: 'desc' },
    });
    const currentWeekLogsByScene = {};
    for (const log of currentWeekExecLogs) {
      if (!currentWeekLogsByScene[log.sceneId]) currentWeekLogsByScene[log.sceneId] = [];
      currentWeekLogsByScene[log.sceneId].push(log);
    }

    const weeklyProgressItems = [];
    const stagnatedScenes = [];

    // ── 本週進度變動 或 本週有新執行日誌（含已完成）────────
    for (const scene of scenes) {
      const histories = historiesByScene[scene.id] || [];

      // 本週有進度變化的記錄
      const currentWeekHistory = histories.filter(h =>
        h.changedAt >= currentStart && h.changedAt <= currentEnd
      );

      // 本週有新增執行日誌
      const weeklyLogs = currentWeekLogsByScene[scene.id] || [];

      // 兩者都沒有 → 不顯示
      if (currentWeekHistory.length === 0 && weeklyLogs.length === 0) continue;

      // 上週最後進度（在 prevEnd 之前最新的一筆）
      const prevRecord = histories.find(h => h.changedAt <= prevEnd);
      const prevProgress = prevRecord ? prevRecord.progressValue : 0;

      const currentProgress = scene.progress;
      const changePercent = currentProgress - prevProgress;
      const indicator = changePercent > 0 ? '↑' : changePercent < 0 ? '↓' : '─';

      // 本週進度歷史的備註（多筆以「；」合併）
      const remarks = currentWeekHistory
        .filter(h => h.remarks)
        .map(h => h.remarks)
        .join('；') || null;

      weeklyProgressItems.push({
        sceneId: scene.id,
        sceneName: scene.sceneName,
        itemNo: scene.itemNo,
        priority: scene.priority,
        status: scene.status,
        currentProgress,
        previousProgress: prevProgress,
        changePercent,
        indicator,
        remarks,
        lastLog: weeklyLogs[0] || scene.executionLogs[0] || null,
        department: scene.department?.name,
        division: scene.department?.division?.name,
        section: scene.section?.name,
      });
    }

    // ── 停滯偵測（只看進行中/規劃中，排除已完成與暫停）────
    for (const scene of stagnationScenes) {
      const histories = historiesByScene[scene.id] || [];

      // 停滯偵測：最近 3 週都沒有進度記錄，或進度未動
      const hasRecentChange = histories.length > 0 && histories[0].progressValue !== scene.progress;
      if (histories.length === 0 || !hasRecentChange) {
        // 取最後一次有進度紀錄的時間（需要更早的資料）
        const lastChange = await prisma.sceneProgressHistory.findFirst({
          where: { sceneId: scene.id },
          orderBy: { changedAt: 'desc' },
        });
        const lastUpdateDate = lastChange ? new Date(lastChange.changedAt) : new Date(scene.createdAt);
        const daysWithoutProgress = Math.floor((new Date() - lastUpdateDate) / (1000 * 60 * 60 * 24));

        if (daysWithoutProgress >= 14) {
          const daysOverdue = scene.targetDate
            ? Math.floor((new Date() - new Date(scene.targetDate)) / (1000 * 60 * 60 * 24))
            : null;
          stagnatedScenes.push({
            sceneId: scene.id,
            sceneName: scene.sceneName,
            itemNo: scene.itemNo,
            priority: scene.priority,
            status: scene.status,
            currentProgress: scene.progress,
            lastUpdateDate: formatDate(lastUpdateDate),
            daysWithoutProgress,
            stagnationWeeks: Math.floor(daysWithoutProgress / 7),
            targetDate: scene.targetDate ? formatDate(new Date(scene.targetDate)) : null,
            daysOverdue: daysOverdue && daysOverdue > 0 ? daysOverdue : null,
            lastLog: scene.executionLogs[0] || null,
            department: scene.department?.name,
            division: scene.department?.division?.name,
            section: scene.section?.name,
          });
        }
      }
    }

    // Top 5 節省時數（全部場景，savingHoursMonthly 優先）
    const topSavings = scenes
      .map(s => ({
        sceneId: s.id,
        itemNo: s.itemNo,
        sceneName: s.sceneName,
        status: s.status,
        priority: s.priority,
        savings: s.savingHoursMonthly != null
          ? s.savingHoursMonthly
          : Math.max(0, (s.originalHours || 0) - (s.improvedHours || 0)),
      }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 5);

    res.json({
      week: `${formatDate(currentStart)} ~ ${formatDate(currentEnd)}`,
      previousWeek: `${formatDate(prevStart)} ~ ${formatDate(prevEnd)}`,
      kpis,
      weeklyProgressItems: weeklyProgressItems.sort((a, b) => b.changePercent - a.changePercent),
      stagnatedScenes,
      topSavings,
    });
  } catch (err) {
    console.error('[Weekly Tracking Error]', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

/**
 * POST /api/weekly-tracking/update-progress
 */
exports.updateProgress = async (req, res) => {
  try {
    const { sceneId, newProgress, remarks } = req.body;
    if (!sceneId || newProgress === undefined) return res.status(400).json({ error: '缺少必要參數' });
    if (newProgress < 0 || newProgress > 100) return res.status(400).json({ error: '進度必須在 0-100 之間' });

    const scene = await prisma.scene.findUnique({ where: { id: sceneId } });
    if (!scene) return res.status(404).json({ error: '場景不存在' });
    if (scene.status === '已完成' && !req.user.roles.includes('admin')) {
      return res.status(403).json({ error: '無法修改已完成的場景' });
    }

    if (scene.progress !== newProgress) {
      await prisma.sceneProgressHistory.create({
        data: { sceneId, progressValue: newProgress, changedAt: new Date(), changedBy: req.user.username, remarks },
      });
      await prisma.scene.update({ where: { id: sceneId }, data: { progress: newProgress } });
    }
    res.json({ message: '進度更新成功', newProgress });
  } catch (err) {
    console.error('[Update Progress Error]', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};

/**
 * POST /api/weekly-tracking/batch-update
 * Body: { updates: [{ sceneId, progress, remarks }] }
 */
exports.batchUpdateProgress = async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: '缺少更新資料' });
    }

    const results = [];
    for (const item of updates) {
      const { sceneId, progress, remarks } = item;
      if (!sceneId || progress === undefined) continue;
      if (progress < 0 || progress > 100) continue;

      const scene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { progress: true, status: true } });
      if (!scene || (scene.status === '已完成' && !req.user.roles.includes('admin'))) continue;

      if (scene.progress !== progress) {
        await prisma.sceneProgressHistory.create({
          data: { sceneId, progressValue: progress, changedAt: new Date(), changedBy: req.user.username, remarks: remarks || null },
        });
        await prisma.scene.update({ where: { id: sceneId }, data: { progress } });
      }
      results.push({ sceneId, progress });
    }
    res.json({ message: `已更新 ${results.length} 個場景`, results });
  } catch (err) {
    console.error('[Batch Update Error]', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
};
