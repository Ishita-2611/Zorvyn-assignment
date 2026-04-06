const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { createUserRules, updateUserRules, idParam, validate } = require('../middleware/validators');

router.use(authenticate);

router.get('/',             authorize('users:read'),   ctrl.listUsers);
router.get('/:id',          idParam, validate,         ctrl.getUser);          // access checked in controller
router.post('/',            authorize('users:create'), createUserRules, validate, ctrl.createUser);
router.patch('/:id',        idParam, validate, updateUserRules, validate, ctrl.updateUser); // access checked in controller
router.delete('/:id',       idParam, validate, authorize('users:delete'), ctrl.deleteUser);
router.patch('/:id/status', idParam, validate, authorize('users:update'), ctrl.setUserStatus);

module.exports = router;
