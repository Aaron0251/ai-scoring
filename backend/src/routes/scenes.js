const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/sceneController');

const router = express.Router();

router.get('/',     authenticate, ctrl.getAll);
router.get('/:id',  authenticate, ctrl.getOne);
router.post('/',    authenticate, ctrl.create);
router.put('/:id',  authenticate, ctrl.update);
router.delete('/:id', authenticate, requireAdmin, ctrl.remove);

module.exports = router;
