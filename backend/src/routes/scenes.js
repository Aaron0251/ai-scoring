const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sceneController');
const prisma = require('../prisma');

const router = express.Router();

router.get('/',     authenticate, ctrl.getAll);
router.get('/:id',  authenticate, ctrl.getOne);
router.post('/',    authenticate, ctrl.create);
router.put('/:id',  authenticate, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

// 場景進度歷程（供趨勢圖使用）
router.get('/:id/progress-history', authenticate, async (req, res) => {
  try {
    const sceneId = parseInt(req.params.id);
    const history = await prisma.sceneProgressHistory.findMany({
      where: { sceneId },
      orderBy: { changedAt: 'asc' },
      select: { progressValue: true, changedAt: true, changedBy: true, remarks: true },
    });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
