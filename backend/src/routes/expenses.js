const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, money, text } = require('../http');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const MONTH = /^\d{4}-\d{2}$/;
const KIND_OF = { salaries: 'salary', rent: 'rent', services: 'service' };

function monthOf(value) {
  const month = String(value || '').trim();
  if (!MONTH.test(month)) throw fail(400, 'Choose a month.');
  return month;
}

const expenseSelect = `
  SELECT
    e.id,
    e.kind,
    e.month,
    e.amount::float8 AS amount,
    e.staff_id AS "staffId",
    u.name AS "staffName",
    e.label,
    e.created_at AS "createdAt"
  FROM expenses e
  LEFT JOIN users u ON u.id = e.staff_id
`;

async function monthPayload(month) {
  const [spent, equipment] = await Promise.all([
    pool.query(
      `${expenseSelect} WHERE e.month = $1 ORDER BY e.created_at DESC, e.id DESC`,
      [month],
    ),
    pool.query(
      `
      SELECT
        i.id,
        i.name,
        i.therapy_type AS "therapyType",
        i.price::float8 AS price,
        i.created_at AS "createdAt"
      FROM instruments i
      WHERE i.price IS NOT NULL
        AND to_char(COALESCE(i.priced_on, (i.created_at AT TIME ZONE 'Asia/Beirut')::date), 'YYYY-MM') = $1
      ORDER BY i.name
      `,
      [month],
    ),
  ]);
  const rows = spent.rows;
  function manual(kind, key, label) {
    const items = rows
      .filter((row) => row.kind === kind)
      .map((row) => ({
        id: row.id,
        label: row.staffName || row.label || label,
        amount: Number(row.amount) || 0,
      }));
    return { key, label, total: items.reduce((sum, item) => sum + item.amount, 0), items };
  }
  const equipmentItems = equipment.rows.map((row) => ({
    id: row.id,
    label: row.name,
    amount: Number(row.price) || 0,
    therapyType: row.therapyType,
  }));
  const categories = [
    manual('salary', 'salaries', 'Salaries'),
    manual('rent', 'rent', 'Rent'),
    manual('service', 'services', 'Services'),
    {
      key: 'equipment',
      label: 'Equipment',
      total: equipmentItems.reduce((sum, item) => sum + item.amount, 0),
      items: equipmentItems,
    },
  ];
  return {
    month,
    total: categories.reduce((sum, category) => sum + category.total, 0),
    categories,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await monthPayload(monthOf(req.query.month)));
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const month = monthOf(req.body.month);
    const payments = Array.isArray(req.body.payments) ? req.body.payments : [];
    if (!payments.length) throw fail(400, 'Add a payment.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const payment of payments) {
        const kind = KIND_OF[payment.category];
        if (!kind) throw fail(400, 'Choose salaries, rent, or services.');
        const amount = money(payment.amount, 'Amount');
        if (amount == null || amount <= 0) throw fail(400, 'Enter the amount paid.');
        let staffId = null;
        let label = text(payment.label, 160, 'Note');
        if (kind === 'salary') {
          staffId = Number(payment.staffId);
          if (!Number.isInteger(staffId)) throw fail(400, 'Choose who was paid.');
          const found = await client.query('SELECT id, name FROM users WHERE id = $1', [staffId]);
          if (!found.rows[0]) throw fail(400, 'Choose who was paid.');
          label = found.rows[0].name;
        } else if (!label) {
          throw fail(400, 'Say what this payment was for.');
        }
        await client.query(
          `
          INSERT INTO expenses (kind, month, amount, staff_id, label)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [kind, month, amount, staffId, label],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json(await monthPayload(month));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await pool.query('SELECT month FROM expenses WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) throw fail(404, 'Payment not found.');
    await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json(await monthPayload(existing.rows[0].month));
  }),
);

module.exports = router;
module.exports.monthPayload = monthPayload;
