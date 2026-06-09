const express = require('express');
const { authenticate, requireAdminOrManager } = require('../middleware/auth');
const ctrl = require('../controllers/resourceLibraryController');

const router = express.Router();

// ─── 場景成果（已完成場景自動納入）─────────────────────────
router.get('/scene-grouped',             authenticate, ctrl.getSceneGrouped);
router.put('/scenes/:sceneId/category',  authenticate, requireAdminOrManager, ctrl.assignSceneCategory);

// ─── 分類 (Categories) ────────────────────────────────────
router.get('/categories',         authenticate, ctrl.getCategories);
router.post('/categories',        authenticate, requireAdminOrManager, ctrl.createCategory);
router.put('/categories/:id',     authenticate, requireAdminOrManager, ctrl.updateCategory);
router.delete('/categories/:id',  authenticate, requireAdminOrManager, ctrl.deleteCategory);

// ─── 工具卡片 (Tools) ─────────────────────────────────────
// 所有人可看（grouped 含最愛標記，需登入）
router.get('/grouped',            authenticate, ctrl.getToolsGrouped);
router.get('/tools',              authenticate, ctrl.getTools);
router.post('/tools',             authenticate, requireAdminOrManager, ctrl.createTool);
router.put('/tools/:id',          authenticate, requireAdminOrManager, ctrl.updateTool);
router.delete('/tools/:id',       authenticate, requireAdminOrManager, ctrl.deleteTool);

// ─── 資源項目 (Items) ─────────────────────────────────────
router.post('/tools/:toolId/items',         authenticate, requireAdminOrManager, ctrl.uploadMiddleware, ctrl.createItem);
router.put('/tools/:toolId/items/:itemId',  authenticate, requireAdminOrManager, ctrl.updateItem);
router.delete('/tools/:toolId/items/:itemId', authenticate, requireAdminOrManager, ctrl.deleteItem);
router.get('/tools/:toolId/items/:itemId/file', ctrl.serveFile); // 自行驗證 token（支援 query 參數）

// ─── 個人最愛 (Favorites) ─────────────────────────────────
router.get('/favorites',                    authenticate, ctrl.getFavorites);
router.post('/favorites/:toolId',           authenticate, ctrl.addFavorite);
router.delete('/favorites/:toolId',         authenticate, ctrl.removeFavorite);
router.put('/favorites/:id/folder',         authenticate, ctrl.updateFavoriteFolder);

module.exports = router;
