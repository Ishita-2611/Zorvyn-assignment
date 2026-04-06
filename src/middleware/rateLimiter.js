/**
 * Simple in-memory rate limiter.
 * Tracks requests per IP per time window.
 */

const windows = new Map();

function rateLimiter({ windowMs = 60_000, max = 100, message = 'Too many requests, please slow down.', keyFn } = {}) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : (req.ip || req.connection.remoteAddress);
    const now = Date.now();
    const entry = windows.get(key);

    if (!entry || now - entry.start > windowMs) {
      windows.set(key, { start: now, count: 1 });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((windowMs - (now - entry.start)) / 1000),
      });
    }
    next();
  };
}

const defaultLimiter = rateLimiter({ windowMs: 60_000, max: 500 });
// Auth limiter keys on IP + email to allow different users to log in freely
const authLimiter = rateLimiter({
  windowMs: 15 * 60_000,
  max: 20,
  message: 'Too many login attempts. Try again in 15 minutes.',
  keyFn: (req) => `auth:${req.ip}:${(req.body?.email || '').toLowerCase()}`,
});

module.exports = { rateLimiter, defaultLimiter, authLimiter };
