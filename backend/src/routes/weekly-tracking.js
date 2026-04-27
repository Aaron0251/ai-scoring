const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/weeklyTrackingController');

const router = express.Router();

router.get('/',    authenticate, ctrl.getWeeklyTracking);
router.post('/update-progress', authenticate, authorize('admin', 'manager', 'chief'), ctrl.updateProgress);
router.post('/batch-update',    authenticate, authorize('admin', 'manager', 'chief'), ctrl.batchUpdateProgress);

module.exports = router;
