const bcrypt = require('bcryptjs');
const { users, audit } = require('../utils/database');
const { signToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Returns a JWT on valid credentials.
 */
async function login(req, res) {
  const { email, password } = req.body;

  const user = users.findByEmail(email);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ success: false, error: 'Account is inactive. Contact an administrator.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  const token = signToken({ id: user.id, role: user.role });
  audit.log(user.id, 'login', 'auth', user.id);

  return res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: {
      token,
      expiresIn: '24h',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
function me(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      createdAt: req.user.createdAt,
    },
  });
}

/**
 * POST /api/auth/refresh
 * Issues a new token for the authenticated user.
 */
function refresh(req, res) {
  const token = signToken({ id: req.user.id, role: req.user.role });
  return res.status(200).json({
    success: true,
    data: { token, expiresIn: '24h' },
  });
}

module.exports = { login, me, refresh };
