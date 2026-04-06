/**
 * Integration test suite.
 * Pure Node.js — no external test runner required.
 * Run: node tests/run.js
 *
 * Tests use the actual Express app in-process (supertest-style via http module).
 */

const http = require('http');
const app  = require('../src/app');

// ─── Minimal HTTP client ──────────────────────────────────────────────────────
let server;
let baseUrl;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port:     server.address().port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ─── Test suites ──────────────────────────────────────────────────────────────
async function runTests() {
  let adminToken, analystToken, viewerToken;
  let createdRecordId, createdUserId;

  // ── Bootstrap: get all tokens first ──────────────────────────────────────
  {
    const r1 = await request('POST', '/api/auth/login', { email: 'admin@finance.dev',  password: 'Admin@123' });
    const r2 = await request('POST', '/api/auth/login', { email: 'alice@finance.dev',  password: 'Alice@123' });
    const r3 = await request('POST', '/api/auth/login', { email: 'victor@finance.dev', password: 'Victor@123' });
    adminToken   = r1.body?.data?.token;
    analystToken = r2.body?.data?.token;
    viewerToken  = r3.body?.data?.token;
    if (!adminToken || !analystToken || !viewerToken) {
      console.error('FATAL: Could not obtain all tokens during bootstrap. Aborting.');
      process.exit(1);
    }
  }

  // ── Health ────────────────────────────────────────────────────────────────
  console.log('\n📋 Health Check');
  await test('GET /health returns 200', async () => {
    const res = await request('GET', '/health');
    assertEqual(res.status, 200);
    assertEqual(res.body.status, 'ok');
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  console.log('\n🔐 Authentication');

  await test('Login with invalid credentials returns 401', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'nobody@x.com', password: 'wrong' });
    assertEqual(res.status, 401);
    assert(!res.body.success);
  });

  await test('Login with invalid email format returns 422', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'not-an-email', password: 'pass' });
    assertEqual(res.status, 422);
  });

  await test('Admin login succeeds', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'admin@finance.dev', password: 'Admin@123' });
    assertEqual(res.status, 200);
    assert(res.body.data?.token);
  });

  await test('Analyst login succeeds', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'alice@finance.dev', password: 'Alice@123' });
    assertEqual(res.status, 200);
  });

  await test('Viewer login succeeds', async () => {
    const res = await request('POST', '/api/auth/login', { email: 'victor@finance.dev', password: 'Victor@123' });
    assertEqual(res.status, 200);
  });

  await test('GET /api/auth/me returns own profile', async () => {
    const res = await request('GET', '/api/auth/me', null, adminToken);
    assertEqual(res.status, 200);
    assertEqual(res.body.data.role, 'admin');
    assert(!res.body.data.password, 'Password must not be returned');
  });

  await test('Protected route without token returns 401', async () => {
    const res = await request('GET', '/api/auth/me');
    assertEqual(res.status, 401);
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log('\n👤 User Management');

  await test('Admin can list users', async () => {
    const res = await request('GET', '/api/users', null, adminToken);
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.data));
    assert(res.body.data.length >= 3);
  });

  await test('Viewer cannot list users', async () => {
    const res = await request('GET', '/api/users', null, viewerToken);
    assertEqual(res.status, 403);
  });

  await test('Analyst cannot list users', async () => {
    const res = await request('GET', '/api/users', null, analystToken);
    assertEqual(res.status, 403);
  });

  await test('Admin can create a user', async () => {
    const res = await request('POST', '/api/users', {
      name: 'Test User', email: 'testuser@finance.dev', password: 'Test@1234', role: 'viewer',
    }, adminToken);
    assertEqual(res.status, 201);
    assert(res.body.data?.id);
    createdUserId = res.body.data.id;
  });

  await test('Duplicate email returns 409', async () => {
    const res = await request('POST', '/api/users', {
      name: 'Dup', email: 'testuser@finance.dev', password: 'Test@1234', role: 'viewer',
    }, adminToken);
    assertEqual(res.status, 409);
  });

  await test('Creating user with weak password returns 422', async () => {
    const res = await request('POST', '/api/users', {
      name: 'Weak', email: 'weak@finance.dev', password: 'short',
    }, adminToken);
    assertEqual(res.status, 422);
  });

  await test('Admin can update user role', async () => {
    const res = await request('PATCH', `/api/users/${createdUserId}`, { role: 'analyst' }, adminToken);
    assertEqual(res.status, 200);
    assertEqual(res.body.data.role, 'analyst');
  });

  await test('Viewer cannot change own role', async () => {
    // Re-login viewer to ensure fresh token
    const loginRes = await request('POST', '/api/auth/login', { email: 'victor@finance.dev', password: 'Victor@123' });
    const freshViewerToken = loginRes.status === 200 ? loginRes.body.data.token : viewerToken;
    assert(freshViewerToken, 'Viewer token must be available');
    const meRes = await request('GET', '/api/auth/me', null, freshViewerToken);
    assertEqual(meRes.status, 200);
    const viewerId = meRes.body.data.id;
    const res = await request('PATCH', `/api/users/${viewerId}`, { role: 'admin' }, freshViewerToken);
    assertEqual(res.status, 403);
  });

  await test('Admin can deactivate user', async () => {
    const res = await request('PATCH', `/api/users/${createdUserId}/status`, { status: 'inactive' }, adminToken);
    assertEqual(res.status, 200);
  });

  await test('Admin can delete user', async () => {
    const res = await request('DELETE', `/api/users/${createdUserId}`, null, adminToken);
    assertEqual(res.status, 200);
  });

  await test('Delete non-existent user returns 404', async () => {
    const res = await request('DELETE', `/api/users/00000000-0000-0000-0000-000000000000`, null, adminToken);
    assertEqual(res.status, 404);
  });

  // ── Records ───────────────────────────────────────────────────────────────
  console.log('\n💰 Financial Records');

  await test('All roles can list records', async () => {
    const r1 = await request('GET', '/api/records', null, adminToken);
    const r2 = await request('GET', '/api/records', null, analystToken);
    const r3 = await request('GET', '/api/records', null, viewerToken);
    assertEqual(r1.status, 200);
    assertEqual(r2.status, 200);
    assertEqual(r3.status, 200);
  });

  await test('Records returned with pagination metadata', async () => {
    const res = await request('GET', '/api/records?page=1&limit=5', null, adminToken);
    assertEqual(res.status, 200);
    assert(res.body.pagination);
    assert(res.body.pagination.total > 0);
    assert(res.body.data.length <= 5);
  });

  await test('Filter records by type=income', async () => {
    const res = await request('GET', '/api/records?type=income', null, adminToken);
    assertEqual(res.status, 200);
    assert(res.body.data.every(r => r.type === 'income'));
  });

  await test('Filter records by date range', async () => {
    const res = await request('GET', '/api/records?dateFrom=2026-03-01&dateTo=2026-03-31', null, analystToken);
    assertEqual(res.status, 200);
    assert(res.body.data.every(r => r.date >= '2026-03-01' && r.date <= '2026-03-31'));
  });

  await test('Admin can create a record', async () => {
    const res = await request('POST', '/api/records', {
      amount: 5000, type: 'income', category: 'Bonus', date: '2026-04-01', notes: 'Q1 performance bonus',
    }, adminToken);
    assertEqual(res.status, 201);
    assert(res.body.data?.id);
    createdRecordId = res.body.data.id;
  });

  await test('Viewer cannot create a record', async () => {
    const res = await request('POST', '/api/records', {
      amount: 100, type: 'expense', category: 'Test',
    }, viewerToken);
    assertEqual(res.status, 403);
  });

  await test('Analyst cannot create a record', async () => {
    const res = await request('POST', '/api/records', {
      amount: 100, type: 'expense', category: 'Test',
    }, analystToken);
    assertEqual(res.status, 403);
  });

  await test('Record creation with negative amount returns 422', async () => {
    const res = await request('POST', '/api/records', {
      amount: -500, type: 'income', category: 'Bad',
    }, adminToken);
    assertEqual(res.status, 422);
  });

  await test('Record creation with invalid type returns 422', async () => {
    const res = await request('POST', '/api/records', {
      amount: 500, type: 'profit', category: 'Bad',
    }, adminToken);
    assertEqual(res.status, 422);
  });

  await test('Admin can update a record', async () => {
    const res = await request('PATCH', `/api/records/${createdRecordId}`, { amount: 6000, notes: 'Updated' }, adminToken);
    assertEqual(res.status, 200);
    assertEqual(res.body.data.amount, 6000);
  });

  await test('Get single record by ID', async () => {
    const res = await request('GET', `/api/records/${createdRecordId}`, null, viewerToken);
    assertEqual(res.status, 200);
    assertEqual(res.body.data.id, createdRecordId);
  });

  await test('Admin can delete (soft) a record', async () => {
    const res = await request('DELETE', `/api/records/${createdRecordId}`, null, adminToken);
    assertEqual(res.status, 200);
  });

  await test('Deleted record no longer accessible', async () => {
    const res = await request('GET', `/api/records/${createdRecordId}`, null, adminToken);
    assertEqual(res.status, 404);
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────
  console.log('\n📊 Dashboard & Analytics');

  await test('All roles can access summary', async () => {
    const res = await request('GET', '/api/dashboard/summary', null, viewerToken);
    assertEqual(res.status, 200);
    assert(res.body.data.totalIncome >= 0);
    assert(res.body.data.totalExpenses >= 0);
    assert('netBalance' in res.body.data);
  });

  await test('Analyst can access category breakdown', async () => {
    const res = await request('GET', '/api/dashboard/categories', null, analystToken);
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.data));
  });

  await test('Viewer cannot access category breakdown', async () => {
    const res = await request('GET', '/api/dashboard/categories', null, viewerToken);
    assertEqual(res.status, 403);
  });

  await test('Analyst can access monthly trends', async () => {
    const res = await request('GET', '/api/dashboard/monthly?months=3', null, analystToken);
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.data));
  });

  await test('Full dashboard combines all sections', async () => {
    const res = await request('GET', '/api/dashboard', null, adminToken);
    assertEqual(res.status, 200);
    assert(res.body.data.summary);
    assert(res.body.data.recentActivity);
    assert(res.body.data.categoryBreakdown);
    assert(res.body.data.monthlyTrends);
  });

  await test('Viewer dashboard excludes analyst-level data', async () => {
    const res = await request('GET', '/api/dashboard', null, viewerToken);
    assertEqual(res.status, 200);
    assert(!res.body.data.categoryBreakdown, 'Viewer should not see category breakdown');
  });

  // ── Audit ─────────────────────────────────────────────────────────────────
  console.log('\n📜 Audit Log');

  await test('Admin can view audit log', async () => {
    const res = await request('GET', '/api/audit', null, adminToken);
    assertEqual(res.status, 200);
    assert(Array.isArray(res.body.data));
    assert(res.body.data.length > 0);
  });

  await test('Viewer cannot view audit log', async () => {
    const res = await request('GET', '/api/audit', null, viewerToken);
    assertEqual(res.status, 403);
  });

  await test('Analyst cannot view audit log', async () => {
    const res = await request('GET', '/api/audit', null, analystToken);
    assertEqual(res.status, 403);
  });

  // ── 404 ───────────────────────────────────────────────────────────────────
  console.log('\n🔍 Edge Cases');

  await test('Unknown route returns 404', async () => {
    const res = await request('GET', '/api/nonexistent');
    assertEqual(res.status, 404);
  });

  await test('Invalid UUID in params returns 422', async () => {
    const res = await request('GET', '/api/records/not-a-uuid', null, adminToken);
    assertEqual(res.status, 422);
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
(async () => {
  server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r)); // random port

  console.log('\n═══════════════════════════════════════════════');
  console.log('  Finance Backend — Integration Test Suite');
  console.log('═══════════════════════════════════════════════');

  await runTests();

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════\n');

  server.close();
  process.exit(failed > 0 ? 1 : 0);
})();
