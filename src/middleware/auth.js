const jwt = require('jsonwebtoken');
const { users } = require('../utils/database');

const JWT_SECRET = process.env.JWT_SECRET || 'finance-secret-dev-key-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

// Role hierarchy: admin > analyst > viewer
const ROLE_LEVELS = { viewer: 1, analyst: 2, admin: 3 };

const PERMISSIONS = {
  // Users
  'users:read':        ['admin'],
  'users:create':      ['admin'],
  'users:update':      ['admin'],
  'users:delete':      ['admin'],
  // Records
  'records:read':      ['viewer', 'analyst', 'admin'],
  'records:create':    ['admin'],
  'records:update':    ['admin'],
  'records:delete':    ['admin'],
  // Dashboard
  'dashboard:read':    ['viewer', 'analyst', 'admin'],
  'dashboard:full':    ['analyst', 'admin'],
  // Audit
  'audit:read':        ['admin'],
};

// ─── Token utilities ──────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// ─── Middleware: require authenticated request ─────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required. Provide a Bearer token.' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    const user = users.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Account is inactive. Contact an administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
}

// ─── Middleware: require specific permission ──────────────────────────────────
function authorize(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }

    const userRole = req.user.role;
    const hasPermission = permissions.some(perm => {
      const allowed = PERMISSIONS[perm];
      return allowed && allowed.includes(userRole);
    });

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required permission: [${permissions.join(', ')}]. Your role: ${userRole}.`,
      });
    }
    next();
  };
}

// ─── Middleware: require minimum role level ───────────────────────────────────
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Not authenticated.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Role '${req.user.role}' is not allowed. Required: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}

// Allow admin to manage own account too
function canManageUser(req, res, next) {
  if (req.user.role === 'admin' || req.user.id === req.params.id) return next();
  return res.status(403).json({ success: false, error: 'You can only manage your own account.' });
}

module.exports = { signToken, verifyToken, authenticate, authorize, requireRole, canManageUser, PERMISSIONS };
