const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, isDate, isTime, localToday, minutes, money, text } = require('../http');
const { therapyOf, doctorFor } = require('../care');
const { THERAPY_EXPR, actorFrom, assertDomain } = require('../scope');

const router = express.Router();
router.use(requireAuth);

const reservationSelect = `
  SELECT
    r.id,
    r.patient_id AS "patientId",
    p.full_name AS "patientName",
    p.phone,
    to_char(r.scheduled_date, 'YYYY-MM-DD') AS "scheduledDate",
    to_char(r.start_time, 'HH24:MI') AS "startTime",
    to_char(r.end_time, 'HH24:MI') AS "endTime",
    r.reason,
    r.status,
    r.notes,
    r.amount_paid::float8 AS "amountPaid",
    r.doctor_id AS "doctorId",
    doc.name AS "doctorName",
    u.name AS "createdByName",
    COALESCE(p.patient_type, 'Private') AS "patientType",
    COALESCE(
      p.therapy_type,
      doc.therapy_type,
      CASE
        WHEN r.reason IN ('Occupational therapy', 'Speech therapy', 'Physiotherapy') THEN r.reason
        ELSE NULL
      END
    ) AS "therapyType"
  FROM reservations r
  JOIN patients p ON p.id = r.patient_id
  LEFT JOIN users doc ON doc.id = r.doctor_id
  LEFT JOIN users u ON u.id = r.created_by
`;

async function findReservation(id) {
  const { rows } = await pool.query(`${reservationSelect} WHERE r.id = $1`, [id]);
  return rows[0] || null;
}

async function overlapsFor(reservation) {
  const { rows } = await pool.query(
    `
    ${reservationSelect}
    WHERE r.scheduled_date = $1::date
      AND r.id <> $2
      AND r.status <> 'cancelled'
      AND r.start_time < $4::time
      AND r.end_time > $3::time
    ORDER BY r.start_time
    `,
    [reservation.scheduledDate, reservation.id, reservation.startTime, reservation.endTime],
  );
  return rows;
}

function scheduleFrom(body) {
  const scheduledDate = text(body.scheduledDate, 10, 'Date');
  const startTime = text(body.startTime, 5, 'Start time');
  const endTime = text(body.endTime, 5, 'End time');
  if (!scheduledDate || !isDate(scheduledDate)) throw fail(400, 'Choose a valid date.');
  if (!startTime || !isTime(startTime) || !endTime || !isTime(endTime)) {
    throw fail(400, 'Use times like 09:30.');
  }
  if (minutes(endTime) <= minutes(startTime)) {
    throw fail(400, 'The visit has to end after it starts.');
  }
  return {
    scheduledDate,
    startTime,
    endTime,
    reason: text(body.reason, 200, 'Reason'),
    notes: text(body.notes, 2000, 'Notes'),
    amountPaid: money(body.amountPaid, 'Amount paid'),
  };
}

const STATUSES = ['scheduled', 'completed', 'cancelled'];

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    const date = isDate(req.query.date) ? req.query.date : localToday();
    const time = isTime(req.query.time) ? req.query.time : '00:00';
    const runningParams = [date, time];
    const pendingParams = [date, time];
    let runningScope = '';
    let pendingScope = '';
    if (actor.limited) {
      runningParams.push(actor.id);
      runningScope = `AND r.doctor_id = $${runningParams.length}`;
      if (actor.therapyType) {
        pendingParams.push(actor.therapyType);
        pendingScope = `AND ${THERAPY_EXPR} = $${pendingParams.length}`;
      } else {
        pendingParams.push(actor.id);
        pendingScope = `AND r.doctor_id = $${pendingParams.length}`;
      }
    }
    const [running, pending] = await Promise.all([
      pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM reservations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN users doc ON doc.id = r.doctor_id
        WHERE r.status IN ('scheduled', 'arrived')
          AND r.scheduled_date = $1::date
          AND r.start_time <= $2::time
          AND r.end_time > $2::time
          ${runningScope}
        `,
        runningParams,
      ),
      pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM reservations r
        JOIN patients p ON p.id = r.patient_id
        LEFT JOIN users doc ON doc.id = r.doctor_id
        WHERE r.status IN ('scheduled', 'arrived')
          AND (
            r.scheduled_date < $1::date
            OR (r.scheduled_date = $1::date AND r.end_time <= $2::time)
          )
          ${pendingScope}
        `,
        pendingParams,
      ),
    ]);
    res.json({
      running: (running.rows[0]?.count || 0) > 0,
      pending: pending.rows[0]?.count || 0,
    });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    const clauses = [];
    const params = [];
    if (isDate(req.query.date) && req.query.pending !== '1') {
      params.push(req.query.date);
      clauses.push(`r.scheduled_date = $${params.length}::date`);
    }
    if (isDate(req.query.from)) {
      params.push(req.query.from);
      clauses.push(`r.scheduled_date >= $${params.length}::date`);
    }
    if (isDate(req.query.to)) {
      params.push(req.query.to);
      clauses.push(`r.scheduled_date <= $${params.length}::date`);
    }
    if (req.query.patientId) {
      const patientId = Number(req.query.patientId);
      if (!Number.isInteger(patientId)) throw fail(400, 'Unknown patient.');
      params.push(patientId);
      clauses.push(`r.patient_id = $${params.length}`);
    }
    if (req.query.pending === '1') {
      const date = isDate(req.query.date) ? req.query.date : localToday();
      const time = isTime(req.query.time) ? req.query.time : '00:00';
      params.push(date, time);
      const dateIndex = params.length - 1;
      const timeIndex = params.length;
      clauses.push(`r.status IN ('scheduled', 'arrived')`);
      clauses.push(`(r.scheduled_date < $${dateIndex}::date OR (r.scheduled_date = $${dateIndex}::date AND r.end_time <= $${timeIndex}::time))`);
    }
    if (actor.limited) {
      if (!actor.therapyType) {
        res.json({ reservations: [] });
        return;
      }
      params.push(actor.therapyType);
      clauses.push(`${THERAPY_EXPR} = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `${reservationSelect} ${where} ORDER BY r.scheduled_date, r.start_time, r.id`,
      params,
    );
    res.json({ reservations: rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    const schedule = scheduleFrom(req.body);
    const status = req.body.status || 'scheduled';
    if (!STATUSES.includes(status)) {
      throw fail(400, 'Unknown visit status.');
    }
    if (status !== 'scheduled' && !['admin', 'sub-admin'].includes(req.user.role)) {
      throw fail(403, 'Your role can book a visit, but not close one.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const patientId = Number(req.body.patientId);
      if (!Number.isInteger(patientId)) throw fail(400, 'Choose a registered patient.');
      const found = await client.query('SELECT id, therapy_type FROM patients WHERE id = $1', [patientId]);
      if (!found.rows[0]) throw fail(404, 'Patient not found.');
      assertDomain(actor, found.rows[0].therapy_type);
      const named = await therapyOf(schedule.reason);
      const onFile = await therapyOf(found.rows[0].therapy_type);
      const therapy = actor.limited ? actor.therapyType : named || onFile;
      const doctor = await doctorFor(req.body.doctorId, therapy);
      if (therapy && !doctor.doctorId) throw fail(400, 'Choose a doctor for this therapy.');

      const created = await client.query(
        `
        INSERT INTO reservations (
          patient_id, scheduled_date, start_time, end_time, reason, status, notes, doctor_id, created_by, amount_paid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        `,
        [
          patientId,
          schedule.scheduledDate,
          schedule.startTime,
          schedule.endTime,
          schedule.reason,
          status,
          schedule.notes,
          doctor.doctorId,
          req.user.id,
          schedule.amountPaid,
        ],
      );
      await client.query('COMMIT');
      const reservation = await findReservation(created.rows[0].id);
      const overlaps = await overlapsFor(reservation);
      res.status(201).json({ reservation, overlaps });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }),
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    const current = await findReservation(req.params.id);
    if (!current) throw fail(404, 'Visit not found.');
    const desk = actor.role === 'admin' || actor.role === 'sub-admin';
    if (!desk) {
      const owns =
        current.doctorId === actor.id ||
        (actor.therapyType && current.therapyType === actor.therapyType);
      if (!owns) throw fail(403, 'That session is outside your therapy.');
    }
    const next = {
      scheduledDate: req.body.scheduledDate ?? current.scheduledDate,
      startTime: req.body.startTime ?? current.startTime,
      endTime: req.body.endTime ?? current.endTime,
      reason: req.body.reason === undefined ? current.reason : text(req.body.reason, 200, 'Reason'),
      notes: req.body.notes === undefined ? current.notes : text(req.body.notes, 2000, 'Notes'),
      status: req.body.status ?? current.status,
      amountPaid: req.body.amountPaid === undefined ? current.amountPaid : money(req.body.amountPaid, 'Amount paid'),
    };
    if (!isDate(next.scheduledDate) || !isTime(next.startTime) || !isTime(next.endTime)) {
      throw fail(400, 'Check the date and times.');
    }
    if (minutes(next.endTime) <= minutes(next.startTime)) {
      throw fail(400, 'The visit has to end after it starts.');
    }
    if (next.status === 'arrived') next.status = 'scheduled';
    if (!STATUSES.includes(next.status)) {
      throw fail(400, 'Unknown visit status.');
    }
    if (!desk) {
      next.scheduledDate = current.scheduledDate;
      next.startTime = current.startTime;
      next.endTime = current.endTime;
      next.reason = current.reason;
    }
    await pool.query(
      `
      UPDATE reservations
      SET scheduled_date = $1, start_time = $2, end_time = $3, reason = $4, notes = $5, status = $6, amount_paid = $7
      WHERE id = $8
      `,
      [next.scheduledDate, next.startTime, next.endTime, next.reason, next.notes, next.status, next.amountPaid, req.params.id],
    );
    const reservation = await findReservation(req.params.id);
    res.json({ reservation, overlaps: await overlapsFor(reservation) });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM reservations WHERE id = $1', [req.params.id]);
    if (!rowCount) throw fail(404, 'Visit not found.');
    res.json({ ok: true });
  }),
);

module.exports = router;
