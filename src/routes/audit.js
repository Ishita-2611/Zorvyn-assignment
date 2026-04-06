const router = require('express').Router();
const { getAuditLog } = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize('audit:read'), getAuditLog);

module.exports = router;
