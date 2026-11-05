const { pool } = require('./db');
const { fail } = require('./http');

const DEFAULT_THERAPIES = ['Occupational therapy', 'Speech therapy', 'Physiotherapy'];

async function listTherapies() {
  const { rows } = await pool.query('SELECT name FROM therapies ORDER BY created_at, name');
  return rows.length ? rows.map((row) => row.name) : [...DEFAULT_THERAPIES];
}

async function therapyOf(value) {
  const therapy = typeof value === 'string' ? value.trim() : '';
  if (!therapy) return null;
  const { rows } = await pool.query('SELECT name FROM therapies WHERE lower(name) = lower($1)', [therapy]);
  return rows[0]?.name ?? null;
}

async function ensureTherapy(value) {
  if (value == null || String(value).trim() === '') return null;
  const known = await therapyOf(value);
  if (!known) throw fail(400, 'Choose a therapy type.');
  return known;
}

async function addTherapy(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 2) throw fail(400, 'Name the therapy.');
  if (name.length > 80) throw fail(400, 'Therapy must be 80 characters or fewer.');
  const existing = await therapyOf(name);
  if (existing) throw fail(409, `${existing} is already on the list.`);
  await pool.query('INSERT INTO therapies (name) VALUES ($1)', [name]);
  return listTherapies();
}

async function doctorFor(doctorId, therapyType) {
  const id = doctorId == null || doctorId === '' ? null : Number(doctorId);
  if (id != null && !Number.isInteger(id)) throw fail(400, 'Choose a doctor.');
  const therapy = await ensureTherapy(therapyType);
  if (!id) return { doctorId: null, doctorName: null };
  const { rows } = await pool.query(
    'SELECT id, name, therapy_type AS "therapyType" FROM users WHERE id = $1 AND therapy_type IS NOT NULL',
    [id],
  );
  const doctor = rows[0];
  if (!doctor) throw fail(400, 'Choose a doctor.');
  if (therapy && doctor.therapyType !== therapy) {
    throw fail(400, 'That doctor does not follow this therapy.');
  }
  return { doctorId: doctor.id, doctorName: doctor.name };
}

module.exports = { DEFAULT_THERAPIES, listTherapies, therapyOf, ensureTherapy, addTherapy, doctorFor };
