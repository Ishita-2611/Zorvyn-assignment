# Finance Data Processing and Access Control Backend
## 🚀 Overview

This project is a secure and scalable backend system for a finance dashboard.  
It allows organizations to manage financial records, enforce role-based access control, and generate analytics insights in real time.

A production-quality REST API backend for a finance dashboard system. Built with Node.js and Express, featuring JWT authentication, role-based access control, financial record management, dashboard analytics, and a full audit trail.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Design Decisions & Assumptions](#design-decisions--assumptions)
- [Roles & Permissions](#roles--permissions)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Users](#users)
  - [Financial Records](#financial-records)
  - [Dashboard & Analytics](#dashboard--analytics)
  - [Audit Log](#audit-log)
- [Error Handling](#error-handling)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [Seed Data](#seed-data)

---

## 🛠 Tech Stack

- Node.js
- Express.js
- JWT (Authentication)
- bcryptjs (Password hashing)
- express-validator (Validation)
- Morgan (Logging)
- Helmet & CORS (Security)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env

# 3. Start the server
npm start
# or for development with auto-reload:
npm run dev
```

Server starts at `http://localhost:3000`.

**Seed credentials (available immediately on startup):**

| Email                    | Password    | Role    |
|--------------------------|-------------|---------|
| admin@finance.dev        | Admin@123   | admin   |
| alice@finance.dev        | Alice@123   | analyst |
| victor@finance.dev       | Victor@123  | viewer  |

---

## Architecture Overview

```
src/
├── app.js                  # Express app setup (middleware, routes, error handlers)
├── server.js               # HTTP server entry point
├── controllers/
│   ├── authController.js   # Login, /me, token refresh
│   ├── userController.js   # User CRUD + status management
│   ├── recordController.js # Financial record CRUD + filtering
│   ├── dashboardController.js # Analytics aggregations
│   └── auditController.js  # Audit log retrieval
├── middleware/
│   ├── auth.js             # JWT verification + role authorization
│   ├── validators.js       # Input validation rules (express-validator)
│   └── rateLimiter.js      # In-memory rate limiter
──public/
│   ├── finance.html        # frontend ui just for demo
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── records.js
│   ├── dashboard.js
│   └── audit.js
└── utils/
    └── database.js         # In-memory data store + seed data + analytics
```

**Request lifecycle:**
```
Request → Helmet/CORS → Morgan logger → Rate limiter
        → Route match → authenticate (JWT) → authorize (role)
        → Input validators → Controller → Response
```

---

## Design Decisions & Assumptions

### Storage
This implementation uses an **in-memory JavaScript store** (`Map`-based) rather than a database. This was a deliberate choice for:
- Zero setup friction — runs with `npm start`, no DB installation required
- Clear separation of the storage layer in `database.js`, making it trivially swappable for PostgreSQL, MongoDB, or SQLite by replacing one file
- The interface (`users.create()`, `records.findAll()`, etc.) mirrors what a real ORM/query builder would expose

For production, swap `src/utils/database.js` with an adapter using `pg`, `mongoose`, or `Prisma`.

### Authentication
JWT-based authentication with 24h expiry. Tokens carry `{ id, role }` — the role is re-validated on every request by re-fetching the user from the store, so role changes take effect immediately (no stale token exploitation).

### Soft Deletes
Financial records use soft deletion (`deleted: true` flag) rather than hard deletes. This preserves audit history and is standard practice for financial systems. Users are hard-deleted (admins explicitly managing access).

### Role Inheritance
Roles are flat (not hierarchical inheritance) — permissions are explicit per-role in the `PERMISSIONS` map in `auth.js`. This makes access control auditable and prevents accidental privilege escalation through inheritance chains.

### Password Policy
Passwords must be at least 8 characters, contain one uppercase letter, and one number. Hashed with `bcryptjs` (cost factor 10).

### Pagination
All list endpoints support `?page=1&limit=20`. Default limit is 20, max is 100.

### Rate Limiting
- General API: 500 requests/minute per IP
- Auth endpoints: 20 attempts per 15 minutes **per IP + email combination** (prevents lockout of legitimate users sharing an IP, e.g. office NAT)

---

## Roles & Permissions

| Action                    | viewer | analyst | admin |
|---------------------------|--------|---------|-------|
| Login / view own profile  | ✓      | ✓       | ✓     |
| View financial records    | ✓      | ✓       | ✓     |
| Dashboard summary         | ✓      | ✓       | ✓     |
| Dashboard recent activity | ✓      | ✓       | ✓     |
| Category breakdown        | ✗      | ✓       | ✓     |
| Monthly/weekly trends     | ✗      | ✓       | ✓     |
| Create/update/delete records | ✗   | ✗       | ✓     |
| List/manage users         | ✗      | ✗       | ✓     |
| View audit log            | ✗      | ✗       | ✓     |

---

## API Reference

All endpoints return JSON. All protected endpoints require:
```
Authorization: Bearer <token>
```

### Authentication

#### `POST /api/auth/login`
Authenticate and receive a JWT.

**Body:**
```json
{
  "email": "admin@finance.dev",
  "password": "Admin@123"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "expiresIn": "24h",
    "user": { "id": "...", "name": "Admin User", "email": "...", "role": "admin" }
  }
}
```

---

#### `GET /api/auth/me` 🔒
Returns the authenticated user's profile.

**Response `200`:**
```json
{
  "success": true,
  "data": { "id": "...", "name": "...", "email": "...", "role": "admin", "status": "active", "createdAt": "..." }
}
```

---

#### `POST /api/auth/refresh` 🔒
Issues a new JWT for the current user.

**Response `200`:**
```json
{ "success": true, "data": { "token": "eyJ...", "expiresIn": "24h" } }
```

---

### Users

#### `GET /api/users` 🔒 (admin)
List all users. Supports `?role=viewer|analyst|admin` and `?status=active|inactive`.

#### `GET /api/users/:id` 🔒
Get a single user. Admins can view any user; others can only view themselves.

#### `POST /api/users` 🔒 (admin)
Create a new user.

**Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@finance.dev",
  "password": "Secure@99",
  "role": "analyst"
}
```

#### `PATCH /api/users/:id` 🔒
Update user fields. Admins can update any user; non-admins can only update their own `name`/`password`.

**Body (all optional):**
```json
{
  "name": "Updated Name",
  "email": "new@email.dev",
  "password": "NewPass@1",
  "role": "analyst",
  "status": "active"
}
```

#### `DELETE /api/users/:id` 🔒 (admin)
Hard-delete a user. Cannot delete your own account.

#### `PATCH /api/users/:id/status` 🔒 (admin)
Toggle user status.

**Body:** `{ "status": "active" }` or `{ "status": "inactive" }`

---

### Financial Records

#### `GET /api/records` 🔒 (viewer, analyst, admin)
List records with optional filters and pagination.

**Query parameters:**

| Param       | Type    | Description                          |
|-------------|---------|--------------------------------------|
| `type`      | string  | `income` or `expense`                |
| `category`  | string  | Partial match on category name       |
| `dateFrom`  | string  | ISO date `YYYY-MM-DD`                |
| `dateTo`    | string  | ISO date `YYYY-MM-DD`                |
| `minAmount` | number  | Minimum amount filter                |
| `maxAmount` | number  | Maximum amount filter                |
| `search`    | string  | Searches notes and category          |
| `page`      | integer | Page number (default: 1)             |
| `limit`     | integer | Items per page (default: 20, max 100)|

**Response `200`:**
```json
{
  "success": true,
  "data": [...],
  "pagination": { "total": 20, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

#### `GET /api/records/:id` 🔒 (viewer, analyst, admin)
Get a single record by UUID.

#### `POST /api/records` 🔒 (admin)
Create a new financial record.

**Body:**
```json
{
  "amount": 15000,
  "type": "income",
  "category": "Consulting",
  "date": "2026-04-01",
  "notes": "Optional description"
}
```

#### `PATCH /api/records/:id` 🔒 (admin)
Update a record. All body fields are optional.

#### `DELETE /api/records/:id` 🔒 (admin)
Soft-delete a record (sets `deleted: true`, excluded from all queries).

---

### Dashboard & Analytics

#### `GET /api/dashboard` 🔒 (all roles)
Combined dashboard. Viewers receive summary + recent activity. Analysts and admins additionally receive category breakdown and monthly trends.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "summary": { "totalIncome": 317100, "totalExpenses": 30130, "netBalance": 286970, "totalRecords": 19 },
    "recentActivity": [...],
    "categoryBreakdown": [...],   // analyst/admin only
    "monthlyTrends": [...]        // analyst/admin only
  }
}
```

---

#### `GET /api/dashboard/summary` 🔒 (all roles)
Total income, expenses, and net balance.

#### `GET /api/dashboard/recent?limit=10` 🔒 (all roles)
Most recent `N` records (max 50).

#### `GET /api/dashboard/categories` 🔒 (analyst, admin)
Income and expense totals grouped by category.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "category": "Salary", "income": 255000, "expense": 0, "net": 255000 },
    { "category": "Rent",   "income": 0, "expense": 9600, "net": -9600 }
  ]
}
```

#### `GET /api/dashboard/monthly?months=6` 🔒 (analyst, admin)
Monthly income/expense trend for the last N months (max 24).

#### `GET /api/dashboard/weekly?weeks=8` 🔒 (analyst, admin)
Weekly income/expense trend for the last N weeks (max 52).

---

### Audit Log

#### `GET /api/audit?limit=50` 🔒 (admin)
Returns the most recent N audit log entries (max 200). Captures all create/update/delete/login events with user ID, action type, resource, and timestamp.

---

## Error Handling

All errors follow a consistent format:

```json
{ "success": false, "error": "Human-readable message." }
```

Validation errors include field-level detail:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "amount", "message": "Amount must be a positive number" }
  ]
}
```

| Status | Meaning                                      |
|--------|----------------------------------------------|
| 200    | Success                                      |
| 201    | Resource created                             |
| 400    | Bad request (business logic violation)       |
| 401    | Not authenticated / invalid/expired token    |
| 403    | Authenticated but not authorized             |
| 404    | Resource not found                           |
| 409    | Conflict (e.g. duplicate email)              |
| 422    | Validation error (invalid input)             |
| 429    | Rate limit exceeded                          |
| 500    | Internal server error                        |

---

## Running Tests

```bash
npm test
```

Runs 43 integration tests covering:
- Authentication (login, token validation, expiry)
- Role-based access for every endpoint
- Input validation edge cases
- CRUD operations for users and records
- Filtering, pagination
- Dashboard access by role
- Audit log access control
- 404 and invalid UUID handling

No external test runner or database setup required.

---

## Project Structure

```
finance-backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   └── utils/
│       └── database.js       # Swap this for a real DB adapter
├── tests/
│   └── run.js                # Self-contained integration test suite
├── .env.example
├── package.json
└── README.md
```

---

## Seed Data

On startup, the database is seeded with:
- 3 users (admin, analyst, viewer)
- 20 realistic financial records across Jan–Mar 2026 spanning categories: Salary, Freelance, Consulting, Rent, Utilities, Software, Marketing, Travel, Payroll, Equipment, Investments, Taxes

This allows the dashboard analytics endpoints to return meaningful data immediately.

---

## Tradeoffs & Notes

- **No persistent storage**: Data resets on server restart. For persistence, the `database.js` layer is the only file that needs to change.
- **In-process rate limiter**: Works for single-instance deployments. For distributed setups, replace with Redis-backed rate limiting (e.g. `rate-limiter-flexible`).
- **JWT secret**: Hardcoded fallback in dev. Always set `JWT_SECRET` via environment variable in production.
- **Soft delete scope**: Only records are soft-deleted. Restoring them would require an admin `PATCH` endpoint — intentionally left as a straightforward extension point.
