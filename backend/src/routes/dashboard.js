const express = require('express');

const { pool } = require('../db');
const { requireAuth } = require('../auth');
const { listTherapies } = require('../care');
const { actorFrom } = require('../scope');
const { asyncHandler, fail } = require('../http');

const router = express.Router();
router.use(requireAuth);

const MONTH = /^\d{4}-\d{2}$/;
const THERAPY_OF = `COALESCE(p.therapy_type, d.therapy_type)`;

function monthBounds(month) {
  const [year, part] = month.split('-').map(Number);
  const last = new Date(year, part, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    const month = String(req.query.month || currentMonth()).trim();
    if (!MONTH.test(month)) throw fail(400, 'Choose a month.');
    const { from, to } = monthBounds(month);
    const therapy = actor.limited ? actor.therapyType : null;
    const range = [from, to, therapy];
    const therapyNames = await listTherapies();
    if (actor.limited && !therapy) {
      res.json({
        totalSessions: 0,
        totalIncome: 0,
        completed: 0,
        arrived: 0,
        scheduled: 0,
        cancelled: 0,
        therapies: therapyNames.map((name) => ({ name, sessions: 0, completed: 0, income: 0 })),
        therapists: [],
        patients: [],
      });
      return;
    }

    const [therapyResult, incomeResult, therapistResult, patientResult, cancelledResult, expenseResult, equipmentResult] = await Promise.all([
      pool.query(
        `
        SELECT
          ${THERAPY_OF} AS therapy,
          COUNT(*)::int AS sessions,
          COUNT(*) FILTER (WHERE r.status = 'completed')::int AS completed
        FROM reservations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN users d ON d.id = r.doctor_id
        WHERE r.status <> 'cancelled'
          AND r.scheduled_date >= $1::date
          AND r.scheduled_date <= $2::date
          AND ($3::text IS NULL OR ${THERAPY_OF} = $3)
        GROUP BY 1
        `,
        range,
      ),
      pool.query(
        `
        SELECT ${THERAPY_OF} AS therapy, COALESCE(SUM(r.amount_paid), 0)::float8 AS income
        FROM reservations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN users d ON d.id = r.doctor_id
        WHERE r.status <> 'cancelled'
          AND r.amount_paid IS NOT NULL
          AND r.scheduled_date >= $1::date
          AND r.scheduled_date <= $2::date
          AND ($3::text IS NULL OR ${THERAPY_OF} = $3)
        GROUP BY 1
        `,
        range,
      ),
      pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.therapy_type AS "therapyType",
          COUNT(r.id) FILTER (WHERE r.status <> 'cancelled')::int AS sessions
        FROM users u
        LEFT JOIN reservations r ON r.doctor_id = u.id
          AND r.scheduled_date >= $1::date
          AND r.scheduled_date <= $2::date
        WHERE u.therapy_type IS NOT NULL
          AND ($3::text IS NULL OR u.therapy_type = $3)
        GROUP BY u.id
        ORDER BY sessions DESC, u.name
        `,
        range,
      ),
      pool.query(
        `
        SELECT
          p.id,
          p.full_name AS "fullName",
          p.therapy_type AS "therapyType",
          COUNT(r.id) FILTER (WHERE r.status <> 'cancelled')::int AS sessions
        FROM patients p
        LEFT JOIN reservations r ON r.patient_id = p.id
          AND r.scheduled_date >= $1::date
          AND r.scheduled_date <= $2::date
        WHERE ($3::text IS NULL OR p.therapy_type = $3)
        GROUP BY p.id
        ORDER BY sessions DESC, p.full_name
        `,
        range,
      ),
      pool.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE r.status = 'completed')::int AS completed,
          COUNT(*) FILTER (WHERE r.status = 'arrived')::int AS arrived,
          COUNT(*) FILTER (WHERE r.status = 'scheduled')::int AS scheduled,
          COUNT(*) FILTER (WHERE r.status = 'cancelled')::int AS cancelled
        FROM reservations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN users d ON d.id = r.doctor_id
        WHERE r.scheduled_date >= $1::date
          AND r.scheduled_date <= $2::date
          AND ($3::text IS NULL OR ${THERAPY_OF} = $3)
        `,
        range,
      ),
      pool.query(
        `
        SELECT COALESCE(SUM(amount), 0)::float8 AS total
        FROM expenses
        WHERE month = $1
        `,
        [month],
      ),
      pool.query(
        `
        SELECT COALESCE(SUM(price), 0)::float8 AS total
        FROM instruments
        WHERE price IS NOT NULL
          AND to_char(COALESCE(priced_on, (created_at AT TIME ZONE 'Asia/Beirut')::date), 'YYYY-MM') = $1
        `,
        [month],
      ),
    ]);

    const sessionMap = new Map(therapyResult.rows.map((row) => [row.therapy, Number(row.sessions) || 0]));
    const completedMap = new Map(therapyResult.rows.map((row) => [row.therapy, Number(row.completed) || 0]));
    const incomeMap = new Map(incomeResult.rows.map((row) => [row.therapy, Number(row.income) || 0]));

    const therapies = therapyNames.map((name) => ({
      name,
      sessions: sessionMap.get(name) ?? 0,
      completed: completedMap.get(name) ?? 0,
      income: incomeMap.get(name) ?? 0,
    }));

    const known = new Set(therapyNames);
    const leftoverSessions = [...sessionMap.entries()].reduce((sum, [name, count]) => (known.has(name) ? sum : sum + count), 0);
    const leftoverCompleted = [...completedMap.entries()].reduce((sum, [name, count]) => (known.has(name) ? sum : sum + count), 0);
    const leftoverIncome = [...incomeMap.entries()].reduce((sum, [name, amount]) => (known.has(name) ? sum : sum + amount), 0);
    if (leftoverSessions || leftoverIncome) {
      therapies.push({ name: 'Unassigned', sessions: leftoverSessions, completed: leftoverCompleted, income: leftoverIncome });
    }

    const totalSessions = therapies.reduce((sum, item) => sum + item.sessions, 0);
    const totalIncome = therapies.reduce((sum, item) => sum + item.income, 0);

    const statusRow = cancelledResult.rows[0] ?? {};
    const payload = {
      totalSessions,
      totalIncome,
      completed: statusRow.completed ?? 0,
      arrived: statusRow.arrived ?? 0,
      scheduled: statusRow.scheduled ?? 0,
      cancelled: statusRow.cancelled ?? 0,
      therapies: actor.limited ? therapies.filter((item) => item.name === actor.therapyType) : therapies,
      therapists: actor.limited ? [] : therapistResult.rows,
      patients: patientResult.rows,
    };
    if (actor.role === 'admin') {
      payload.totalOutcome = (Number(expenseResult.rows[0]?.total) || 0) + (Number(equipmentResult.rows[0]?.total) || 0);
    }
    res.json(payload);
  }),
);

module.exports = router;
