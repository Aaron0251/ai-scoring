const prisma = require('../prisma');
const { canAccessScene } = require('./sceneController');

exports.getAll = async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    if (!(await canAccessScene(sceneId, req.user))) return res.status(403).json({ error: '無權存取此場景' });

    const { from, to } = req.query;
    const where = { sceneId };
    if (from || to) {
      where.logDate = {};
      if (from) where.logDate.gte = new Date(from);
      if (to)   where.logDate.lte = new Date(to);
    }

    const logs = await prisma.sceneExecutionLog.findMany({ where, orderBy: { logDate: 'desc' } });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: '取得執行日誌失敗：' + err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    if (!(await canAccessScene(sceneId, req.user))) return res.status(403).json({ error: '無權存取此場景' });

    const { logDate, executor, content, status, note } = req.body;
    if (!logDate || !content) return res.status(400).json({ error: 'logDate 和 content 為必填' });

    const log = await prisma.sceneExecutionLog.create({
      data: {
        sceneId,
        logDate: new Date(logDate),
        executor: executor || null,
        content,
        status: status || '完成',
        note: note || null,
      },
    });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: '新增執行日誌失敗：' + err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const logId   = parseInt(req.params.logId);
    if (!(await canAccessScene(sceneId, req.user))) return res.status(403).json({ error: '無權存取此場景' });

    const existing = await prisma.sceneExecutionLog.findUnique({ where: { id: logId } });
    if (!existing || existing.sceneId !== sceneId) return res.status(404).json({ error: '紀錄不存在' });

    const { logDate, executor, content, status, note } = req.body;
    const updated = await prisma.sceneExecutionLog.update({
      where: { id: logId },
      data: {
        ...(logDate    && { logDate: new Date(logDate) }),
        ...(executor !== undefined && { executor }),
        ...(content    && { content }),
        ...(status     && { status }),
        ...(note !== undefined && { note }),
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: '更新執行日誌失敗：' + err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const logId   = parseInt(req.params.logId);
    if (!(await canAccessScene(sceneId, req.user))) return res.status(403).json({ error: '無權存取此場景' });

    const existing = await prisma.sceneExecutionLog.findUnique({ where: { id: logId } });
    if (!existing || existing.sceneId !== sceneId) return res.status(404).json({ error: '紀錄不存在' });

    await prisma.sceneExecutionLog.delete({ where: { id: logId } });
    res.json({ message: '刪除成功' });
  } catch (err) {
    res.status(500).json({ error: '刪除執行日誌失敗：' + err.message });
  }
};
