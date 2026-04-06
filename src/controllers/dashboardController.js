const { analytics, audit } = require('../utils/database');

/**
 * GET /api/dashboard/summary
 * All roles: total income, expenses, net balance.
 */
function summary(req, res) {
  const data = analytics.summary();
  return res.status(200).json({ success: true, data });
}

/**
 * GET /api/dashboard/categories
 * Analyst/Admin: breakdown by category.
 */
function byCategory(req, res) {
  const data = analytics.byCategory();
  return res.status(200).json({ success: true, data });
}

/**
 * GET /api/dashboard/monthly
 * Analyst/Admin: monthly income/expense trends.
 * Query: ?months=6
 */
function monthly(req, res) {
  const months = parseInt(req.query.months) || 6;
  if (months < 1 || months > 24) {
    return res.status(422).json({ success: false, error: 'months must be between 1 and 24.' });
  }
  const data = analytics.monthlyTrends(months);
  return res.status(200).json({ success: true, data });
}

/**
 * GET /api/dashboard/weekly
 * Analyst/Admin: weekly income/expense trends.
 * Query: ?weeks=8
 */
function weekly(req, res) {
  const weeks = parseInt(req.query.weeks) || 8;
  if (weeks < 1 || weeks > 52) {
    return res.status(422).json({ success: false, error: 'weeks must be between 1 and 52.' });
  }
  const data = analytics.weeklyTrends(weeks);
  return res.status(200).json({ success: true, data });
}

/**
 * GET /api/dashboard/recent
 * All roles: recent financial activity.
 * Query: ?limit=10
 */
function recent(req, res) {
  const limit = parseInt(req.query.limit) || 10;
  if (limit < 1 || limit > 50) {
    return res.status(422).json({ success: false, error: 'limit must be between 1 and 50.' });
  }
  const data = analytics.recentActivity(limit);
  return res.status(200).json({ success: true, data });
}

/**
 * GET /api/dashboard
 * All roles: combined dashboard view.
 */
function dashboard(req, res) {
  const isAnalystOrAdmin = ['analyst', 'admin'].includes(req.user.role);

  const payload = {
    summary: analytics.summary(),
    recentActivity: analytics.recentActivity(5),
  };

  if (isAnalystOrAdmin) {
    payload.categoryBreakdown = analytics.byCategory();
    payload.monthlyTrends = analytics.monthlyTrends(6);
  }

  return res.status(200).json({ success: true, data: payload });
}

module.exports = { summary, byCategory, monthly, weekly, recent, dashboard };
