const { body, query, param, validationResult } = require('express-validator');

// ─── Reusable validation runner ───────────────────────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// ─── Auth validators ──────────────────────────────────────────────────────────
const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── User validators ──────────────────────────────────────────────────────────
const createUserRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role').optional().isIn(['viewer', 'analyst', 'admin']).withMessage('Role must be viewer, analyst, or admin'),
];

const updateUserRules = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
  body('email').optional().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('role').optional().isIn(['viewer', 'analyst', 'admin']).withMessage('Invalid role'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
];

// ─── Record validators ────────────────────────────────────────────────────────
const createRecordRules = [
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('category').trim().notEmpty().withMessage('Category is required').isLength({ max: 100 }).withMessage('Category max 100 chars'),
  body('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format').toDate(),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes max 500 characters'),
];

const updateRecordRules = [
  body('amount').optional().isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('type').optional().isIn(['income', 'expense']).withMessage('Type must be income or expense'),
  body('category').optional().trim().notEmpty().withMessage('Category cannot be empty').isLength({ max: 100 }),
  body('date').optional().isISO8601().withMessage('Date must be in YYYY-MM-DD format').toDate(),
  body('notes').optional().trim().isLength({ max: 500 }),
];

// ─── Query validators ─────────────────────────────────────────────────────────
const recordQueryRules = [
  query('type').optional().isIn(['income', 'expense']).withMessage('type must be income or expense'),
  query('dateFrom').optional().isISO8601().withMessage('dateFrom must be YYYY-MM-DD'),
  query('dateTo').optional().isISO8601().withMessage('dateTo must be YYYY-MM-DD'),
  query('minAmount').optional().isFloat({ gt: 0 }).withMessage('minAmount must be positive'),
  query('maxAmount').optional().isFloat({ gt: 0 }).withMessage('maxAmount must be positive'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1–100'),
];

const idParam = [
  param('id').isUUID().withMessage('ID must be a valid UUID'),
];

module.exports = {
  validate,
  loginRules,
  createUserRules,
  updateUserRules,
  createRecordRules,
  updateRecordRules,
  recordQueryRules,
  idParam,
};
