const router = require('express').Router();
const ctrl = require('../controllers/dashboardController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/',          authorize('dashboard:read'), ctrl.dashboard);
router.get('/summary',   authorize('dashboard:read'), ctrl.summary);
router.get('/recent',    authorize('dashboard:read'), ctrl.recent);
router.get('/categories',authorize('dashboard:full'), ctrl.byCategory);
router.get('/monthly',   authorize('dashboard:full'), ctrl.monthly);
router.get('/weekly',    authorize('dashboard:full'), ctrl.weekly);

module.exports = router;
