const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/executionLogController');

const router = express.Router({ mergeParams: true });

router.get('/',         authenticate, ctrl.getAll);
router.post('/',        authenticate, ctrl.create);
router.put('/:logId',   authenticate, ctrl.update);
router.delete('/:logId', authenticate, ctrl.remove);

module.exports = router;
