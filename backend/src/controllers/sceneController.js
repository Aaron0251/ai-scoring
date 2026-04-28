const prisma = require('../prisma');
const { getAccessibleDeptIds } = require('../utils/accessControl');

// ── 輔助：判斷使用者能否存取特定場景 ──────────────────────
async function canAccessScene(sceneId, user) {
  const allowedDeptIds = await getAccessibleDeptIds(user);
  if (allowedDeptIds === null) return true;
  if (allowedDeptIds.length === 0) return false;

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { departmentId: true },
  });
  return scene ? allowedDeptIds.includes(scene.departmentId) : false;
}

exports.getAll = async (req, res) => {
  const { departmentId, sectionId, divisionId, status, priority, keyword, active } = req.query;

  const allowedDeptIds = await getAccessibleDeptIds(req.user);
  // allowedDeptIds === null  → 無限制（看全部）
  // allowedDeptIds = array   → 限制在這些部門

  const where = {};
  if (allowedDeptIds !== null) where.departmentId = { in: allowedDeptIds };

  // divisionId 篩選：取出該本部的部門，再與 allowedDeptIds 取交集
  if (divisionId) {
    const divDepts = await prisma.department.findMany({
      where: { divisionId: parseInt(divisionId) },
      select: { id: true },
    });
    const divDeptIds = divDepts.map(d => d.id);
    const effectiveIds = allowedDeptIds !== null
      ? divDeptIds.filter(id => allowedDeptIds.includes(id))
      : divDeptIds;
    where.departmentId = { in: effectiveIds };
  }

  if (departmentId) {
    const reqDeptId = parseInt(departmentId);
    if (allowedDeptIds !== null && !allowedDeptIds.includes(reqDeptId)) return res.json([]);
    where.departmentId = reqDeptId;
  }
  if (sectionId) where.sectionId = parseInt(sectionId);
  if (status)    where.status    = status;
  if (priority)  where.priority  = priority;
  if (keyword)   where.sceneName = { contains: keyword };
  where.active = active !== undefined ? active === 'true' : true;

  const scenes = await prisma.scene.findMany({
    where,
    include: {
      department: { include: { division: true } },
      section: true,
      benefits: true,
      executionLogs: { orderBy: { logDate: 'desc' }, take: 1 },
      actualSavings: true,
    },
    orderBy: { itemNo: 'asc' },
  });

  res.json(scenes.map(s => ({
    ...s,
    efficiencyGainPct: calcEfficiencyGain(s),
    lastLog: s.executionLogs?.[0] ?? null,
  })));
};

exports.getOne = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const scene = await prisma.scene.findUnique({
      where: { id },
      include: { department: { include: { division: true } }, section: true, benefits: true },
    });
    if (!scene) return res.status(404).json({ error: '場景不存在' });

    const allowedDeptIds = await getAccessibleDeptIds(req.user);
    if (allowedDeptIds !== null && !allowedDeptIds.includes(scene.departmentId)) {
      return res.status(403).json({ error: '無權存取此場景' });
    }

    res.json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
  } catch (err) {
    res.status(500).json({ error: '取得場景失敗：' + err.message });
  }
};

exports.create = async (req, res) => {
  const roles = req.user.roles;
  if (!roles.includes('admin') && !roles.includes('manager') && !roles.includes('boss') && !roles.includes('chief') && !roles.includes('executive')) {
    return res.status(403).json({ error: '僅限管理員、推動管理者、業務主管、主管或公司管理層新增場景' });
  }
  const body = req.body;
  if (!body.sceneName)    return res.status(400).json({ error: '場景名稱為必填' });
  if (!body.departmentId) return res.status(400).json({ error: '所屬部門為必填' });

  const itemNo = await generateItemNo();
  const scene = await prisma.scene.create({
    data: {
      itemNo,
      departmentId: parseInt(body.departmentId),
      sectionId: body.sectionId ? parseInt(body.sectionId) : null,
      sceneName: body.sceneName,
      maintainOrDevelop: body.maintainOrDevelop || null,
      itAssisted: body.itAssisted !== undefined ? Boolean(body.itAssisted) : null,
      developMethod: body.developMethod || null,
      developToolDesc: body.developToolDesc || null,
      agentCategory: body.agentCategory || null,
      inputDesc: body.inputDesc || null,
      outputDesc: body.outputDesc || null,
      taskSteps: body.taskSteps || null,
      rawDataExample: body.rawDataExample || null,
      finalDataExample: body.finalDataExample || null,
      timePerExecution: body.timePerExecution ? String(body.timePerExecution) : null,
      monthlyFrequency: body.monthlyFrequency ? String(body.monthlyFrequency) : null,
      demandCount: body.demandCount ? parseInt(body.demandCount) : null,
      taskOwners: body.taskOwners || null,
      seedOwners: body.seedOwners || null,
      priority: body.priority || '中',
      status: body.status || '規劃中',
      progress: body.progress !== undefined ? parseInt(body.progress) : 0,
      establishDate: body.establishDate ? new Date(body.establishDate) : null,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      goLiveDate: body.goLiveDate ? new Date(body.goLiveDate) : null,
      originalHours: body.originalHours != null ? parseFloat(body.originalHours) : null,
      improvedHours: body.improvedHours != null ? parseFloat(body.improvedHours) : null,
      originalHeadcount: body.originalHeadcount != null ? parseInt(body.originalHeadcount) : null,
      improvedHeadcount: body.improvedHeadcount != null ? parseInt(body.improvedHeadcount) : null,
      resultText: body.resultText || null,
      actualResultText: body.actualResultText || null,
      otherMetrics: body.otherMetrics || null,
      note: body.note || null,
    },
    include: { department: { include: { division: true } }, section: true },
  });

  res.status(201).json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
};

exports.update = async (req, res) => {
  const roles = req.user.roles;
  if (!roles.includes('admin') && !roles.includes('manager') && !roles.includes('boss') && !roles.includes('chief') && !roles.includes('executive')) {
    return res.status(403).json({ error: '僅限管理員、推動管理者、業務主管、主管或公司管理層編輯場景' });
  }
  const id = parseInt(req.params.id);
  if (roles.includes('manager') && !roles.includes('admin') && !roles.includes('boss') && !roles.includes('executive')) {
    const accessible = await canAccessScene(id, req.user);
    if (!accessible) return res.status(403).json({ error: '無權編輯此場景' });
  }

  const oldScene = await prisma.scene.findUnique({ where: { id } });

  const body = req.body;
  const data = {};

  const stringFields = ['sceneName', 'maintainOrDevelop', 'developMethod', 'developToolDesc', 'agentCategory', 'inputDesc', 'outputDesc', 'taskSteps', 'rawDataExample', 'finalDataExample', 'taskOwners', 'seedOwners', 'priority', 'status', 'resultText', 'actualResultText', 'otherMetrics', 'note'];
  for (const f of stringFields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  const intFields = ['departmentId', 'sectionId', 'demandCount', 'progress', 'originalHeadcount', 'improvedHeadcount'];
  for (const f of intFields) {
    if (body[f] !== undefined) data[f] = body[f] !== null ? parseInt(body[f]) : null;
  }

  const textFields = ['timePerExecution', 'monthlyFrequency'];
  for (const f of textFields) {
    if (body[f] !== undefined) data[f] = body[f] !== null ? String(body[f]) : null;
  }

  const floatFields = ['originalHours', 'improvedHours'];
  for (const f of floatFields) {
    if (body[f] !== undefined) data[f] = body[f] !== null ? parseFloat(body[f]) : null;
  }

  const dateFields = ['establishDate', 'targetDate', 'goLiveDate'];
  for (const f of dateFields) {
    if (body[f] !== undefined) data[f] = body[f] ? new Date(body[f]) : null;
  }

  if (body.itAssisted !== undefined) {
    data.itAssisted = body.itAssisted !== null ? Boolean(body.itAssisted) : null;
  }

  const scene = await prisma.scene.update({
    where: { id },
    data,
    include: { department: { include: { division: true } }, section: true, benefits: true },
  });

  // 進度變更時記錄歷史
  if (oldScene && body.progress !== undefined && oldScene.progress !== scene.progress) {
    await prisma.sceneProgressHistory.create({
      data: {
        sceneId: id,
        progressValue: scene.progress,
        changedAt: new Date(),
        changedBy: req.user.username,
        remarks: body.progressRemarks || null,
      },
    });
  }

  res.json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.scene.delete({ where: { id } });
  res.json({ message: '已刪除' });
};

// ── 內部輔助函式 ──────────────────────────────────────────
async function generateItemNo() {
  const last = await prisma.scene.findFirst({ orderBy: { id: 'desc' } });
  if (!last) return 'AI-0001';
  const match = last.itemNo.match(/AI-(\d+)/);
  const next = match ? parseInt(match[1]) + 1 : 1;
  return `AI-${String(next).padStart(4, '0')}`;
}

function calcEfficiencyGain(scene) {
  const original = scene.originalHours ?? 0;
  const improved = scene.improvedHours ?? 0;
  if (original > 0) {
    return Math.round(((original - improved) / original) * 100 * 10) / 10;
  }
  return null;
}

exports.canAccessScene = canAccessScene;
