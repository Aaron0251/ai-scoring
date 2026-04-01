const prisma = require('../prisma');

// ── 輔助：判斷使用者能否存取特定場景 ──────────────────────
async function canAccessScene(sceneId, user) {
  const roles = user.roles;
  if (roles.includes('admin') || roles.includes('boss') || roles.includes('executive')) return true;

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: {
      departmentId: true,
      taskOwners: true,
      seedOwners: true,
      department: { select: { divisionId: true } },
    },
  });
  if (!scene) return false;

  if (roles.includes('chief')) {
    if (user.divisionId) {
      return scene.department?.divisionId === user.divisionId;
    }
    const orgChiefs = await prisma.orgChief.findMany({ where: { userId: user.id } });
    const deptSet = new Set();
    for (const oc of orgChiefs) {
      if (oc.entityType === 'division') {
        const depts = await prisma.department.findMany({ where: { divisionId: oc.entityId }, select: { id: true } });
        depts.forEach(d => deptSet.add(d.id));
      } else if (oc.entityType === 'department') {
        deptSet.add(oc.entityId);
      } else if (oc.entityType === 'section') {
        const sec = await prisma.section.findUnique({ where: { id: oc.entityId }, select: { departmentId: true } });
        if (sec) deptSet.add(sec.departmentId);
      }
    }
    return deptSet.has(scene.departmentId);
  }

  if (roles.includes('manager')) {
    if (user.divisionId) {
      return scene.department?.divisionId === user.divisionId;
    }
    return false;
  }

  return false;
}

exports.getAll = async (req, res) => {
  const { departmentId, sectionId, divisionId, status, priority, keyword, active } = req.query;
  const roles = req.user.roles;
  const userName = req.user.name;

  let allowedDeptIds = null;
  let nameFilter = null;

  if (!roles.includes('admin') && !roles.includes('boss') && !roles.includes('executive')) {
    const isManager = roles.includes('manager');
    const isChief = roles.includes('chief');

    if (isManager && !isChief) {
      // manager 依本部（divisionId）過濾，與 chief 相同邏輯
      if (req.user.divisionId) {
        const depts = await prisma.department.findMany({
          where: { divisionId: req.user.divisionId },
          select: { id: true },
        });
        allowedDeptIds = depts.map(d => d.id);
      } else {
        return res.json([]);
      }
    } else if (isChief) {
      let deptSet = new Set();
      if (req.user.divisionId) {
        const depts = await prisma.department.findMany({
          where: { divisionId: req.user.divisionId },
          select: { id: true },
        });
        depts.forEach(d => deptSet.add(d.id));
      } else {
        const orgChiefs = await prisma.orgChief.findMany({ where: { userId: req.user.id } });
        if (orgChiefs.length === 0) return res.json([]);
        for (const oc of orgChiefs) {
          if (oc.entityType === 'division') {
            const depts = await prisma.department.findMany({ where: { divisionId: oc.entityId }, select: { id: true } });
            depts.forEach(d => deptSet.add(d.id));
          } else if (oc.entityType === 'department') {
            deptSet.add(oc.entityId);
          } else if (oc.entityType === 'section') {
            const sec = await prisma.section.findUnique({ where: { id: oc.entityId }, select: { departmentId: true } });
            if (sec) deptSet.add(sec.departmentId);
          }
        }
      }
      allowedDeptIds = [...deptSet];
    } else {
      return res.json([]);
    }
  }

  const where = {};
  if (allowedDeptIds !== null) where.departmentId = { in: allowedDeptIds };

  if (divisionId && allowedDeptIds === null) {
    const depts = await prisma.department.findMany({ where: { divisionId: parseInt(divisionId) }, select: { id: true } });
    where.departmentId = { in: depts.map(d => d.id) };
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

  if (nameFilter) {
    where.OR = [
      { taskOwners: { contains: nameFilter } },
      { seedOwners: { contains: nameFilter } },
    ];
  }

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
    const roles = req.user.roles;
    const scene = await prisma.scene.findUnique({
      where: { id },
      include: { department: { include: { division: true } }, section: true, benefits: true },
    });
    if (!scene) return res.status(404).json({ error: '場景不存在' });

    if (!roles.includes('admin') && !roles.includes('executive') && !roles.includes('boss')) {
      if (roles.includes('chief')) {
        let allowed = false;
        if (req.user.divisionId) {
          allowed = scene.department?.divisionId === req.user.divisionId;
        } else {
          const orgChiefs = await prisma.orgChief.findMany({ where: { userId: req.user.id } });
          const deptSet = new Set();
          for (const oc of orgChiefs) {
            if (oc.entityType === 'division') {
              const depts = await prisma.department.findMany({ where: { divisionId: oc.entityId }, select: { id: true } });
              depts.forEach(d => deptSet.add(d.id));
            } else if (oc.entityType === 'department') {
              deptSet.add(oc.entityId);
            } else if (oc.entityType === 'section') {
              const sec = await prisma.section.findUnique({ where: { id: oc.entityId }, select: { departmentId: true } });
              if (sec) deptSet.add(sec.departmentId);
            }
          }
          allowed = deptSet.has(scene.departmentId);
        }
        if (!allowed) return res.status(403).json({ error: '無權存取此場景' });
      } else if (roles.includes('manager')) {
        let allowed = false;
        if (req.user.divisionId) {
          allowed = scene.department?.divisionId === req.user.divisionId;
        }
        if (!allowed) return res.status(403).json({ error: '無權存取此場景' });
      } else {
        return res.status(403).json({ error: '無權存取此場景' });
      }
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
  // manager 只能編輯本部場景
  if (roles.includes('manager') && !roles.includes('admin') && !roles.includes('boss') && !roles.includes('executive')) {
    const accessible = await canAccessScene(id, req.user);
    if (!accessible) return res.status(403).json({ error: '無權編輯此場景' });
  }
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

  if (data.status === '已完成' && !data.completedDate) {
    data.completedDate = new Date();
  }

  const scene = await prisma.scene.update({
    where: { id },
    data,
    include: { department: { include: { division: true } }, section: true, benefits: true },
  });

  res.json({ ...scene, efficiencyGainPct: calcEfficiencyGain(scene) });
};

exports.remove = async (req, res) => {
  const id = parseInt(req.params.id);
  await prisma.scene.update({ where: { id }, data: { active: false } });
  res.json({ message: '已封存' });
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
  if (scene.timeSavedHours && scene.actualTimeSavedHours) {
    return Math.round(((scene.actualTimeSavedHours - scene.timeSavedHours) / scene.timeSavedHours) * 100 * 10) / 10;
  }
  return null;
}

exports.canAccessScene = canAccessScene;
