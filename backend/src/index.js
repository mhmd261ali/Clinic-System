const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, waitForDb } = require('./db');
const { runSetup } = require('./setup');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const reservationRoutes = require('./routes/reservations');
const documentRoutes = require('./routes/documents');
const userRoutes = require('./routes/users');
const doctorRoutes = require('./routes/doctors');
const instrumentRoutes = require('./routes/instruments');
const incomeRoutes = require('./routes/income');
const dashboardRoutes = require('./routes/dashboard');
const expenseRoutes = require('./routes/expenses');
const settingsRoutes = require('./routes/settings');
const therapyRoutes = require('./routes/therapies');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/therapies', therapyRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((error, _req, res, _next) => {
  if (error.status) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error.code === '23505') {
    res.status(409).json({ error: 'That email is already in use.' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

async function main() {
  await waitForDb();
  const ready = await pool.query(`SELECT to_regclass('public.users') AS name`);
  if (!ready.rows[0].name) {
    console.log('First start: creating the clinic database and demo desk.');
    await runSetup();
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS instruments (
      id SERIAL PRIMARY KEY,
      therapy_type TEXT NOT NULL,
      name TEXT NOT NULL,
      used_for TEXT NOT NULL,
      file_name TEXT,
      stored_name TEXT,
      mime_type TEXT,
      added_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS instruments_therapy_idx ON instruments (therapy_type, name)');
  await pool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS staff_id INTEGER REFERENCES users (id) ON DELETE SET NULL');
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_type TEXT`);
  await pool.query(`UPDATE patients SET patient_type = 'Private' WHERE patient_type IS NULL OR btrim(patient_type) = ''`);
  await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS sessions_allotted INTEGER`);
  await pool.query(`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2)`);
  await pool.query('DELETE FROM documents WHERE stored_name IS NULL OR file_name IS NULL');
  await pool.query('ALTER TABLE instruments ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2)');
  await pool.query('ALTER TABLE instruments ADD COLUMN IF NOT EXISTS priced_on DATE');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('salary', 'rent', 'service')),
      month TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      staff_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clinic_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      reminder_mode TEXT NOT NULL DEFAULT 'hours' CHECK (reminder_mode IN ('hours', 'tomorrow')),
      reminder_hours INTEGER NOT NULL DEFAULT 24,
      reminder_time TIME NOT NULL DEFAULT '18:00'
    )
  `);
  await pool.query(`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reminder_mode TEXT NOT NULL DEFAULT 'hours'`);
  await pool.query(`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reminder_hours INTEGER NOT NULL DEFAULT 24`);
  await pool.query(`ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS reminder_time TIME NOT NULL DEFAULT '18:00'`);
  await pool.query(`
    INSERT INTO clinic_settings (id, reminder_mode, reminder_hours, reminder_time)
    VALUES (1, 'hours', 24, '18:00')
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS therapies (
      name TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    INSERT INTO therapies (name)
    SELECT seed.name
    FROM (VALUES ('Occupational therapy'), ('Speech therapy'), ('Physiotherapy')) AS seed(name)
    WHERE NOT EXISTS (SELECT 1 FROM therapies existing WHERE lower(existing.name) = lower(seed.name))
  `);
  await pool.query(`UPDATE reservations SET status = 'scheduled' WHERE status = 'arrived'`);
  await pool.query(`DELETE FROM reservations WHERE reason = 'Session now' AND notes = 'Live session so the booking dot is visible.'`);
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => {
    console.log(`PhysioCore API listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { app };
