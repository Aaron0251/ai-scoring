const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl    = require('../controllers/leaderTrackingController');

// 所有路由需要登入
router.use(authenticate);

// GET /api/leader-tracking
// 取得種子負責人概覽清單
router.get('/', ctrl.getLeaders);

// GET /api/leader-tracking/:userId/scenes
// 取得特定種子負責人的場景清單
router.get('/:userId/scenes', ctrl.getLeaderScenes);

module.exports = router;
