const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/importController');

const router = express.Router();

router.post('/excel',       authenticate, authorize('admin', 'manager', 'boss'), ctrl.uploadMiddleware, ctrl.importExcel);
router.get('/template',    authenticate, ctrl.getTemplate);
router.get('/export',      authenticate, authorize('admin'), ctrl.exportExcel);
router.post('/org-persons', authenticate, authorize('admin'), ctrl.uploadMiddleware, ctrl.importOrgPersons);
router.get('/org-template', authenticate, authorize('admin'), ctrl.getOrgTemplate);

module.exports = router;
