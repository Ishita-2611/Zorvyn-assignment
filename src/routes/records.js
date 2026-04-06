const router = require('express').Router();
const ctrl = require('../controllers/recordController');
const { authenticate, authorize } = require('../middleware/auth');
const { createRecordRules, updateRecordRules, recordQueryRules, idParam, validate } = require('../middleware/validators');

router.use(authenticate);

router.get('/',     authorize('records:read'),   recordQueryRules, validate, ctrl.listRecords);
router.get('/:id',  authorize('records:read'),   idParam, validate, ctrl.getRecord);
router.post('/',    authorize('records:create'), createRecordRules, validate, ctrl.createRecord);
router.patch('/:id', authorize('records:update'), idParam, validate, updateRecordRules, validate, ctrl.updateRecord);
router.delete('/:id', authorize('records:delete'), idParam, validate, ctrl.deleteRecord);

module.exports = router;
