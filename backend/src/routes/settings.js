const express = require('express');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, isTime, wholeNumber } = require('../http');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const CHOICES = [1, 2, 6, 12, 24, 48];
const TIMES = ['07:00', '08:00', '09:00', '12:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

function reminderFrom(row) {
  return {
    mode: row.mode === 'tomorrow' ? 'tomorrow' : 'before',
    reminderHours: Number(row.hours) || 24,
    reminderTime: String(row.time || '18:00').slice(0, 5),
  };
}

async function current() {
  const { rows } = await pool.query(
    `SELECT reminder_mode AS mode, reminder_hours AS hours, reminder_time AS time FROM clinic_settings WHERE id = 1`,
  );
  const settings = reminderFrom(rows[0] || { mode: 'hours', hours: 24, time: '18:00' });
  const choices = CHOICES.includes(settings.reminderHours)
    ? CHOICES
    : [...CHOICES, settings.reminderHours].sort((left, right) => left - right);
  const times = TIMES.includes(settings.reminderTime) ? TIMES : [...TIMES, settings.reminderTime].sort();
  return { choices, times, settings };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await current());
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const mode = req.body.mode === 'tomorrow' ? 'tomorrow' : req.body.mode === 'before' ? 'before' : null;
    if (!mode) throw fail(400, 'Choose hours before the session, or a time for tomorrow.');
    const hours = wholeNumber(req.body.reminderHours, 'Hours');
    const time = String(req.body.reminderTime || '').slice(0, 5);
    if (mode === 'before' && (hours == null || !CHOICES.includes(hours))) {
      throw fail(400, 'Choose how many hours before the session.');
    }
    if (mode === 'tomorrow' && !TIMES.includes(time)) throw fail(400, 'Choose a time of day.');
    if (time && !isTime(time)) throw fail(400, 'Choose a time like 18:00.');
    await pool.query(
      `
      INSERT INTO clinic_settings (id, reminder_mode, reminder_hours, reminder_time)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        reminder_mode = EXCLUDED.reminder_mode,
        reminder_hours = EXCLUDED.reminder_hours,
        reminder_time = EXCLUDED.reminder_time
      `,
      [mode === 'tomorrow' ? 'tomorrow' : 'hours', hours || 24, isTime(time) ? time : '18:00'],
    );
    res.json(await current());
  }),
);

module.exports = router;
