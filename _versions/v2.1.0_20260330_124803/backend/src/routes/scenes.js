const express = require('express');
const prisma = require('../prisma');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── 輔助：自動產生場景編號 AI-XXXX ──────────────
async function generateItemNo() {
  const last = await prisma.scene.findFirst({ orderBy: { id: 'desc' } });
  if (!last) return 'AI-0001';
  const match = last.itemNo.match(/AI-(\d+)/);
  const next = match ? parseInt(match[1]) + 1 : 1;
  return `AI-${String(next).padStart(4, '0')}`;
}

// GET /api/scenes
router.get('/', authenticate, async (req, res) => {
  const { departmentId, sectionId, divisionId, status, priority, keyword, active } = req.query;
  const where = {};

  // divisionId: 再查該本部所屬的部門 id 清單
  if (divisionId) {
    const depts = await prisma.department.findMany({ where: { divisionId: parseInt(divisionId) }, select: { id: true } });
    where.departmentId = { in: depts.map(d => d.id) };
  }
  if (departmentId) where.departmentId = parseInt(departmentId);
  if (sectionId) where.sectionId = parseInt(sectionId);
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (keyword) where.sceneName = { contains: keyword };
  if (active !== undefined) where.active = active === 'true';
  else where.active = true;

  // 非管理員只能看自己部門的場景
  const roles = req.user.roles;
  if (!roles.includes('admin') && !roles.includes('executive')) {
    where.departmentId = req.user.departmentId;
  }

  const scenes = await prisma.scene.findMany({
    where,
    include: {
      department: { include: { division: true } },
      section: true,
      benefits: true,
    },
    orderBy: { itemNo: 'asc' },
  });

  // 計算效率增益
  const result = scenes.map(s => ({
    ...s,
    efficiencyGainPct: calcEfficiencyGain(s),
  }));

  res.json(result);
});

// GET /api/scenes/:id
router.get('/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id);
  const scene = await prisma.scene.findUnique({
    where: { id },
    include: {
      department: { include: { division: true } },
      section: true,
      benefits: true,
    },
  });
  if (!scene) return res.status(404).json({ error: '場景不存在' });
  res.json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
});

// POST /api/scenes
router.post('/', authenticate, async (req, res) => {
  const roles = req.user.roles;
  if (!roles.includes('admin') && !roles.includes('manager')) {
    return res.status(403).json({ error: '僅限管理員或推動管理者新增場景' });
  }
  const body = req.body;
  if (!body.sceneName) return res.status(400).json({ error: '場景名稱為必填' });
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
      directSupervisor: body.directSupervisor || null,
      priority: body.priority || '中',
      status: body.status || '規劃中',
      progress: body.progress !== undefined ? parseInt(body.progress) : 0,
      establishDate: body.establishDate ? new Date(body.establishDate) : null,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      goLiveDate: body.goLiveDate ? new Date(body.goLiveDate) : null,
      timeSavedHours: body.timeSavedHours ? parseFloat(body.timeSavedHours) : null,
      actualTimeSavedHours: body.actualTimeSavedHours ? parseFloat(body.actualTimeSavedHours) : null,
      actualDemandCount: body.actualDemandCount ? parseInt(body.actualDemandCount) : null,
      resultText: body.resultText || null,
      actualResultText: body.actualResultText || null,
      otherMetrics: body.otherMetrics || null,
      note: body.note || null,
    },
    include: { department: { include: { division: true } }, section: true },
  });

  res.status(201).json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
});

// PUT /api/scenes/:id
router.put('/:id', authenticate, async (req, res) => {
  const roles = req.user.roles;
  if (!roles.includes('admin') && !roles.includes('manager')) {
    return res.status(403).json({ error: '僅限管理員或推動管理者編輯場景' });
  }
  const id = parseInt(req.params.id);
  const body = req.body;
  const data = {};

  const fields = [
    'sceneName', 'maintainOrDevelop', 'developMethod', 'developToolDesc',
    'agentCategory', 'inputDesc', 'outputDesc', 'taskSteps',
    'rawDataExample', 'finalDataExample', 'taskOwners', 'seedOwners',
    'directSupervisor', 'priority', 'status', 'resultText',
    'actualResultText', 'otherMetrics', 'note',
  ];
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  const intFields = ['departmentId', 'sectionId', 'demandCount', 'progress', 'actualDemandCount'];
  for (const f of intFields) {
    if (body[f] !== undefined) data[f] = body[f] !== null ? parseInt(body[f]) : null;
  }

  // timePerExecution 、monthlyFrequency 現為文字欄（如「30分鐘」、「每週次」）
  const textFields = ['timePerExecution', 'monthlyFrequency'];
  for (const f of textFields) {
    if (body[f] !== undefined) data[f] = body[f] !== null ? String(body[f]) : null;
  }

  const floatFields = ['timeSavedHours', 'actualTimeSavedHours'];
  for (const f of floatFields) {
    if (body[f] !== undefined) data[f] = body[f] !== null ? parseFloat(body[f]) : null;
  }

  const dateFields = ['establishDate', 'targetDate', 'goLiveDate', 'completedDate'];
  for (const f of dateFields) {
    if (body[f] !== undefined) data[f] = body[f] ? new Date(body[f]) : null;
  }

  if (body.itAssisted !== undefined) {
    data.itAssisted = body.itAssisted !== null ? Boolean(body.itAssisted) : null;
  }

  // 若 status 設為已完成且沒有 completedDate，自動填入
  if (data.status === '已完成' && !data.completedDate) {
    data.completedDate = new Date();
  }

  const scene = await prisma.scene.update({
    where: { id },
    data,
    include: { department: { include: { division: true } }, section: true, benefits: true },
  });

  res.json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
});

// DELETE /api/scenes/:id（軟刪除）
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.scene.update({ where: { id }, data: { active: false } });
  res.json({ message: '已封存' });
});

// ── 效率增益計算 ──────────────────────────────
function calcEfficiencyGain(scene) {
  if (scene.timeSavedHours && scene.actualTimeSavedHours) {
    return Math.round(((scene.actualTimeSavedHours - scene.timeSavedHours) / scene.timeSavedHours) * 100 * 10) / 10;
  }
  return null;
}

module.exports = router;
