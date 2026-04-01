const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/efficiencyReportController');

const router = express.Router();

router.get('/', authenticate, authorize('admin', 'executive', 'chief'), ctrl.getReport);

module.exports = router;

