const { audit } = require('../utils/database');

/**
 * GET /api/audit
 * Admin only: view recent audit trail.
 */
function getAuditLog(req, res) {
  const limit = parseInt(req.query.limit) || 50;
  const data = audit.recent(Math.min(limit, 200));
  return res.status(200).json({ success: true, data, total: data.length });
}

module.exports = { getAuditLog };
