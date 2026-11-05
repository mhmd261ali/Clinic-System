DROP TABLE IF EXISTS expenses, clinic_settings, instruments, documents, reservations, patients, therapies, users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'sub-admin', 'user')),
  phone TEXT,
  therapy_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  gender TEXT,
  notes TEXT,
  therapy_type TEXT,
  doctor TEXT,
  doctors TEXT[] NOT NULL DEFAULT '{}',
  doctor_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  patient_type TEXT NOT NULL DEFAULT 'Private' CHECK (patient_type IN ('Private', 'Company', 'Islamic')),
  sessions_allotted INTEGER CHECK (sessions_allotted IS NULL OR sessions_allotted >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'arrived', 'completed', 'cancelled')),
  notes TEXT,
  doctor_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  amount_paid NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  patient_id INTEGER REFERENCES patients (id) ON DELETE SET NULL,
  staff_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  file_name TEXT,
  stored_name TEXT,
  mime_type TEXT,
  uploaded_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (patient_id IS NULL OR staff_id IS NULL)
);

CREATE TABLE instruments (
  id SERIAL PRIMARY KEY,
  therapy_type TEXT NOT NULL,
  name TEXT NOT NULL,
  used_for TEXT NOT NULL,
  file_name TEXT,
  stored_name TEXT,
  mime_type TEXT,
  price NUMERIC(12, 2),
  priced_on DATE,
  added_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('salary', 'rent', 'service')),
  month TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  staff_id INTEGER REFERENCES users (id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE therapies (
  name TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clinic_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  reminder_mode TEXT NOT NULL DEFAULT 'hours' CHECK (reminder_mode IN ('hours', 'tomorrow')),
  reminder_hours INTEGER NOT NULL DEFAULT 24,
  reminder_time TIME NOT NULL DEFAULT '18:00'
);

CREATE INDEX reservations_date_idx ON reservations (scheduled_date, start_time);
CREATE INDEX reservations_patient_idx ON reservations (patient_id, scheduled_date);
CREATE INDEX patients_name_idx ON patients (full_name);
CREATE INDEX documents_name_idx ON documents (name);
CREATE INDEX instruments_therapy_idx ON instruments (therapy_type, name);

INSERT INTO therapies (name) VALUES
  ('Occupational therapy'),
  ('Speech therapy'),
  ('Physiotherapy');
