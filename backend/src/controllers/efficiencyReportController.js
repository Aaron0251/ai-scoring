const prisma = require('../prisma');

exports.getReport = async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ error: '請提供 periodId' });

  const period = await prisma.efficiencyPeriod.findUnique({
    where: { id: parseInt(periodId) },
    include: { criteria: { orderBy: { orderIndex: 'asc' } } },
  });
  if (!period) return res.status(404).json({ error: '效率評估期別不存在' });

  const evals = await prisma.efficiencyEval.findMany({
    where: { periodId: parseInt(periodId), submitted: true },
    include: { criterion: true },
  });

  const targetIds = [...new Set(evals.map(e => e.targetId))];
  const targets = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, name: true, departmentId: true, department: { select: { name: true } } },
    include: { department: true },
  });
  const targetMap = Object.fromEntries(targets.map(t => [t.id, t]));

  const byTarget = {};
  for (const e of evals) {
    const tid = e.targetId;
    if (!byTarget[tid]) byTarget[tid] = { target: targetMap[tid], criteria: {} };
    const cid = e.criterionId;
    if (!byTarget[tid].criteria[cid]) byTarget[tid].criteria[cid] = { name: e.criterion.name, scores: [] };
    if (e.score !== null) byTarget[tid].criteria[cid].scores.push(e.score);
  }

  const report = Object.values(byTarget).map(item => {
    const criteriaAvg = Object.values(item.criteria).map(c => ({
      name: c.name,
      avg: c.scores.length > 0
        ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length * 10) / 10
        : null,
      count: c.scores.length,
    }));
    const totalScores = criteriaAvg.filter(c => c.avg !== null).map(c => c.avg);
    return {
      target: item.target,
      criteriaAvg,
      overallAvg: totalScores.length > 0
        ? Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length * 10) / 10
        : null,
    };
  });

  res.json({ period, report });
};
