const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '登入嘗試過多，請 15 分鐘後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login',           loginLimiter, authController.login);
router.get('/me',               authenticate, authController.me);
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
