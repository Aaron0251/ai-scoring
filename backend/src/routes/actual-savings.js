const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getAll, upsert } = require('../controllers/actualSavingsController');

const router = express.Router({ mergeParams: true }); // mergeParams to get :sceneId

router.get('/',        authenticate, getAll);
router.put('/:year',   authenticate, upsert);

module.exports = router;
