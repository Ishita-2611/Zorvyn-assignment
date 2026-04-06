const bcrypt = require('bcryptjs');
const { users, audit } = require('../utils/database');

/**
 * GET /api/users
 * Admin only. List all users with optional filters.
 */
function listUsers(req, res) {
  const { role, status } = req.query;
  const list = users.findAll({ role, status });
  return res.status(200).json({ success: true, data: list, total: list.length });
}

/**
 * GET /api/users/:id
 * Admin can view any user. Others can only view themselves.
 */
function getUser(req, res) {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

  // Non-admins can only see their own profile
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    return res.status(403).json({ success: false, error: 'Access denied.' });
  }

  const { password, ...safe } = user;
  return res.status(200).json({ success: true, data: safe });
}

/**
 * POST /api/users
 * Admin only. Create a new user.
 */
async function createUser(req, res) {
  const { name, email, password, role } = req.body;

  if (users.emailTaken(email)) {
    return res.status(409).json({ success: false, error: 'A user with this email already exists.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = users.create({ name, email, password: hashed, role });
  audit.log(req.user.id, 'create', 'user', user.id, { email, role });

  return res.status(201).json({
    success: true,
    message: 'User created successfully.',
    data: user,
  });
}

/**
 * PATCH /api/users/:id
 * Admin can update any user. Users can update their own name/password only.
 */
async function updateUser(req, res) {
  const target = users.findById(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'User not found.' });

  // Restrict non-admins: can only update own name/password
  if (req.user.role !== 'admin') {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    // Non-admins cannot change role or status
    if (req.body.role || req.body.status) {
      return res.status(403).json({ success: false, error: 'You cannot change your own role or status.' });
    }
  }

  // Email uniqueness check
  if (req.body.email && users.emailTaken(req.body.email, req.params.id)) {
    return res.status(409).json({ success: false, error: 'Email is already in use.' });
  }

  const updateData = { ...req.body };
  if (req.body.password) {
    updateData.password = await bcrypt.hash(req.body.password, 10);
  }

  const updated = users.update(req.params.id, updateData);
  audit.log(req.user.id, 'update', 'user', req.params.id, { fields: Object.keys(req.body) });

  return res.status(200).json({ success: true, message: 'User updated.', data: updated });
}

/**
 * DELETE /api/users/:id
 * Admin only. Prevents self-deletion.
 */
function deleteUser(req, res) {
  if (req.user.id === req.params.id) {
    return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
  }

  const exists = users.findById(req.params.id);
  if (!exists) return res.status(404).json({ success: false, error: 'User not found.' });

  users.delete(req.params.id);
  audit.log(req.user.id, 'delete', 'user', req.params.id);

  return res.status(200).json({ success: true, message: 'User deleted successfully.' });
}

/**
 * PATCH /api/users/:id/status
 * Admin only. Toggle user active/inactive.
 */
function setUserStatus(req, res) {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) {
    return res.status(422).json({ success: false, error: 'Status must be active or inactive.' });
  }

  if (req.user.id === req.params.id && status === 'inactive') {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
  }

  const target = users.findById(req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'User not found.' });

  const updated = users.update(req.params.id, { status });
  audit.log(req.user.id, 'status_change', 'user', req.params.id, { status });

  return res.status(200).json({ success: true, message: `User ${status === 'active' ? 'activated' : 'deactivated'}.`, data: updated });
}

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, setUserStatus };
