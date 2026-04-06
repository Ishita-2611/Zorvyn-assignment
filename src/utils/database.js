/**
 * In-memory database with a clean relational-style interface.
 * Stores data in plain JS Maps/arrays. Seeded with demo data on startup.
 * For production: swap this layer with any SQL/NoSQL adapter.
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ─── Storage ────────────────────────────────────────────────────────────────
const db = {
  users: new Map(),
  records: new Map(),
  auditLog: [],
};

// ─── Generic helpers ─────────────────────────────────────────────────────────
const generateId = () => uuidv4();

const now = () => new Date().toISOString();

// ─── User operations ─────────────────────────────────────────────────────────
const users = {
  create(data) {
    const user = {
      id: generateId(),
      name: data.name,
      email: data.email.toLowerCase().trim(),
      password: data.password, // already hashed by caller
      role: data.role || 'viewer',
      status: data.status || 'active',
      createdAt: now(),
      updatedAt: now(),
    };
    db.users.set(user.id, user);
    return sanitizeUser(user);
  },

  findById(id) {
    return db.users.get(id) || null;
  },

  findByEmail(email) {
    for (const u of db.users.values()) {
      if (u.email === email.toLowerCase().trim()) return u;
    }
    return null;
  },

  findAll({ role, status } = {}) {
    let list = [...db.users.values()];
    if (role)   list = list.filter(u => u.role === role);
    if (status) list = list.filter(u => u.status === status);
    return list.map(sanitizeUser);
  },

  update(id, data) {
    const user = db.users.get(id);
    if (!user) return null;
    const allowed = ['name', 'email', 'role', 'status', 'password'];
    for (const key of allowed) {
      if (data[key] !== undefined) user[key] = data[key];
    }
    user.updatedAt = now();
    db.users.set(id, user);
    return sanitizeUser(user);
  },

  delete(id) {
    return db.users.delete(id);
  },

  exists(id) {
    return db.users.has(id);
  },

  emailTaken(email, excludeId = null) {
    for (const u of db.users.values()) {
      if (u.email === email.toLowerCase().trim() && u.id !== excludeId) return true;
    }
    return false;
  },
};

function sanitizeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// ─── Financial record operations ──────────────────────────────────────────────
const records = {
  create(data) {
    const record = {
      id: generateId(),
      amount: parseFloat(data.amount),
      type: data.type, // 'income' | 'expense'
      category: data.category,
      date: data.date || now().split('T')[0],
      notes: data.notes || null,
      createdBy: data.createdBy,
      deleted: false,
      createdAt: now(),
      updatedAt: now(),
    };
    db.records.set(record.id, record);
    return record;
  },

  findById(id) {
    const r = db.records.get(id);
    return r && !r.deleted ? r : null;
  },

  findAll(filters = {}) {
    let list = [...db.records.values()].filter(r => !r.deleted);

    if (filters.type)      list = list.filter(r => r.type === filters.type);
    if (filters.category)  list = list.filter(r => r.category.toLowerCase().includes(filters.category.toLowerCase()));
    if (filters.dateFrom)  list = list.filter(r => r.date >= filters.dateFrom);
    if (filters.dateTo)    list = list.filter(r => r.date <= filters.dateTo);
    if (filters.minAmount) list = list.filter(r => r.amount >= parseFloat(filters.minAmount));
    if (filters.maxAmount) list = list.filter(r => r.amount <= parseFloat(filters.maxAmount));
    if (filters.search)    list = list.filter(r =>
      r.notes?.toLowerCase().includes(filters.search.toLowerCase()) ||
      r.category.toLowerCase().includes(filters.search.toLowerCase())
    );

    // Sort newest first by default
    list.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const page  = parseInt(filters.page)  || 1;
    const limit = parseInt(filters.limit) || 20;
    const total = list.length;
    const data  = list.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  update(id, data) {
    const record = db.records.get(id);
    if (!record || record.deleted) return null;
    const allowed = ['amount', 'type', 'category', 'date', 'notes'];
    for (const key of allowed) {
      if (data[key] !== undefined) record[key] = key === 'amount' ? parseFloat(data[key]) : data[key];
    }
    record.updatedAt = now();
    db.records.set(id, record);
    return record;
  },

  softDelete(id) {
    const record = db.records.get(id);
    if (!record || record.deleted) return false;
    record.deleted = true;
    record.updatedAt = now();
    return true;
  },

  hardDelete(id) {
    return db.records.delete(id);
  },
};

// ─── Analytics / Dashboard helpers ───────────────────────────────────────────
const analytics = {
  summary() {
    const active = [...db.records.values()].filter(r => !r.deleted);
    const income  = active.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const expense = active.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    return { totalIncome: income, totalExpenses: expense, netBalance: income - expense, totalRecords: active.length };
  },

  byCategory() {
    const active = [...db.records.values()].filter(r => !r.deleted);
    const map = {};
    for (const r of active) {
      if (!map[r.category]) map[r.category] = { category: r.category, income: 0, expense: 0, net: 0 };
      map[r.category][r.type === 'income' ? 'income' : 'expense'] += r.amount;
      map[r.category].net = map[r.category].income - map[r.category].expense;
    }
    return Object.values(map).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  },

  monthlyTrends(months = 6) {
    const active = [...db.records.values()].filter(r => !r.deleted);
    const map = {};
    for (const r of active) {
      const month = r.date.slice(0, 7); // YYYY-MM
      if (!map[month]) map[month] = { month, income: 0, expense: 0, net: 0 };
      map[month][r.type === 'income' ? 'income' : 'expense'] += r.amount;
      map[month].net = map[month].income - map[month].expense;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-months);
  },

  recentActivity(limit = 10) {
    return [...db.records.values()]
      .filter(r => !r.deleted)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  },

  weeklyTrends(weeks = 8) {
    const active = [...db.records.values()].filter(r => !r.deleted);
    const map = {};
    for (const r of active) {
      const d = new Date(r.date);
      // ISO week number
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      if (!map[key]) map[key] = { week: key, income: 0, expense: 0, net: 0 };
      map[key][r.type === 'income' ? 'income' : 'expense'] += r.amount;
      map[key].net = map[key].income - map[key].expense;
    }
    return Object.values(map).sort((a, b) => a.week.localeCompare(b.week)).slice(-weeks);
  },
};

// ─── Audit log ────────────────────────────────────────────────────────────────
const audit = {
  log(userId, action, resource, resourceId, meta = {}) {
    db.auditLog.push({ id: generateId(), userId, action, resource, resourceId, meta, timestamp: now() });
  },
  recent(limit = 50) {
    return [...db.auditLog].reverse().slice(0, limit);
  },
};

// ─── Seed data ────────────────────────────────────────────────────────────────
async function seed() {
  const hash = (p) => bcrypt.hashSync(p, 10);

  // Users
  const admin = users.create({ name: 'Admin User', email: 'admin@finance.dev', password: hash('Admin@123'), role: 'admin' });
  const analyst = users.create({ name: 'Alice Analyst', email: 'alice@finance.dev', password: hash('Alice@123'), role: 'analyst' });
  const viewer = users.create({ name: 'Victor Viewer', email: 'victor@finance.dev', password: hash('Victor@123'), role: 'viewer' });

  // Financial records (realistic sample data)
  const sampleRecords = [
    { amount: 85000,  type: 'income',  category: 'Salary',        date: '2026-03-01', notes: 'Monthly salary - March' },
    { amount: 12000,  type: 'income',  category: 'Freelance',     date: '2026-03-05', notes: 'UI design project' },
    { amount: 3200,   type: 'expense', category: 'Rent',          date: '2026-03-01', notes: 'Office rent' },
    { amount: 850,    type: 'expense', category: 'Utilities',     date: '2026-03-03', notes: 'Electricity & internet' },
    { amount: 4500,   type: 'expense', category: 'Software',      date: '2026-03-07', notes: 'Annual SaaS subscriptions' },
    { amount: 1200,   type: 'expense', category: 'Marketing',     date: '2026-03-10', notes: 'Social media ads' },
    { amount: 22000,  type: 'income',  category: 'Consulting',    date: '2026-03-15', notes: 'Strategy consulting Q1' },
    { amount: 680,    type: 'expense', category: 'Travel',        date: '2026-03-18', notes: 'Client visit flights' },
    { amount: 3100,   type: 'expense', category: 'Payroll',       date: '2026-03-25', notes: 'Part-time contractor' },
    { amount: 85000,  type: 'income',  category: 'Salary',        date: '2026-02-01', notes: 'Monthly salary - February' },
    { amount: 8500,   type: 'income',  category: 'Freelance',     date: '2026-02-12', notes: 'Backend API project' },
    { amount: 3200,   type: 'expense', category: 'Rent',          date: '2026-02-01', notes: 'Office rent' },
    { amount: 760,    type: 'expense', category: 'Utilities',     date: '2026-02-04', notes: 'Monthly utilities' },
    { amount: 2100,   type: 'expense', category: 'Equipment',     date: '2026-02-20', notes: 'New keyboard & monitor' },
    { amount: 5600,   type: 'income',  category: 'Investments',   date: '2026-02-28', notes: 'Dividend payout Q4' },
    { amount: 85000,  type: 'income',  category: 'Salary',        date: '2026-01-01', notes: 'Monthly salary - January' },
    { amount: 3200,   type: 'expense', category: 'Rent',          date: '2026-01-01', notes: 'Office rent' },
    { amount: 15000,  type: 'income',  category: 'Consulting',    date: '2026-01-20', notes: 'Product audit contract' },
    { amount: 9800,   type: 'expense', category: 'Taxes',         date: '2026-01-31', notes: 'Q4 advance tax payment' },
    { amount: 1800,   type: 'expense', category: 'Marketing',     date: '2026-01-15', notes: 'Content creation' },
  ];

  for (const r of sampleRecords) {
    records.create({ ...r, createdBy: admin.id });
  }
}

seed();

module.exports = { users, records, analytics, audit, sanitizeUser, generateId };
