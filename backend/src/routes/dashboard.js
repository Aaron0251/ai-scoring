const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

const router = express.Router();

router.get('/',               authenticate, ctrl.getStats);
router.get('/drilldown',      authenticate, ctrl.drilldown);
router.get('/execution-table', authenticate, ctrl.executionTable);

module.exports = router;

