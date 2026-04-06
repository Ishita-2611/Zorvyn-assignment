const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { loginRules, validate } = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/login',   authLimiter, loginRules, validate, authController.login);
router.get('/me',       authenticate, authController.me);
router.post('/refresh', authenticate, authController.refresh);

module.exports = router;
