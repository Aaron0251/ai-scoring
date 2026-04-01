const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/configController');

const router = express.Router();

router.get('/',      authenticate,              ctrl.getAll);
router.put('/:key',  authenticate, requireAdmin, ctrl.update);

module.exports = router;

