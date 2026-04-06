const { records, audit } = require('../utils/database');

/**
 * GET /api/records
 * Viewer/Analyst/Admin: list records with filters & pagination.
 */
function listRecords(req, res) {
  const filters = {
    type:      req.query.type,
    category:  req.query.category,
    dateFrom:  req.query.dateFrom,
    dateTo:    req.query.dateTo,
    minAmount: req.query.minAmount,
    maxAmount: req.query.maxAmount,
    search:    req.query.search,
    page:      req.query.page,
    limit:     req.query.limit,
  };

  const result = records.findAll(filters);

  return res.status(200).json({
    success: true,
    data: result.data,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    },
  });
}

/**
 * GET /api/records/:id
 * Viewer/Analyst/Admin: get a single record.
 */
function getRecord(req, res) {
  const record = records.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }
  return res.status(200).json({ success: true, data: record });
}

/**
 * POST /api/records
 * Admin only: create a new financial record.
 */
function createRecord(req, res) {
  const { amount, type, category, date, notes } = req.body;

  const record = records.create({
    amount,
    type,
    category,
    date: date ? (typeof date === 'string' ? date : date.toISOString().split('T')[0]) : undefined,
    notes,
    createdBy: req.user.id,
  });

  audit.log(req.user.id, 'create', 'record', record.id, { type, category, amount });

  return res.status(201).json({
    success: true,
    message: 'Financial record created.',
    data: record,
  });
}

/**
 * PATCH /api/records/:id
 * Admin only: update an existing record.
 */
function updateRecord(req, res) {
  const existing = records.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  const { amount, type, category, date, notes } = req.body;
  const updateData = {};
  if (amount    !== undefined) updateData.amount   = amount;
  if (type      !== undefined) updateData.type     = type;
  if (category  !== undefined) updateData.category = category;
  if (notes     !== undefined) updateData.notes    = notes;
  if (date      !== undefined) updateData.date     = typeof date === 'string' ? date : date.toISOString().split('T')[0];

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ success: false, error: 'No valid fields provided for update.' });
  }

  const updated = records.update(req.params.id, updateData);
  audit.log(req.user.id, 'update', 'record', req.params.id, { fields: Object.keys(updateData) });

  return res.status(200).json({ success: true, message: 'Record updated.', data: updated });
}

/**
 * DELETE /api/records/:id
 * Admin only: soft-delete a record.
 */
function deleteRecord(req, res) {
  const existing = records.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  records.softDelete(req.params.id);
  audit.log(req.user.id, 'delete', 'record', req.params.id);

  return res.status(200).json({ success: true, message: 'Record deleted (soft delete). It can be restored if needed.' });
}

module.exports = { listRecords, getRecord, createRecord, updateRecord, deleteRecord };
