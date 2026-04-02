const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/rolePermissionController');

const router = express.Router();

// GET /api/role-permissions — 取得所有角色功能權限（admin only）
router.get('/', authenticate, requireAdmin, ctrl.getAll);

// PUT /api/role-permissions — 批次更新（admin only）
router.put('/', authenticate, requireAdmin, ctrl.updateBatch);

module.exports = router;
