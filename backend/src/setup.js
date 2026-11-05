const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const { uploadsDir } = require('./paths');
const { seedInstruments } = require('./seedInstruments');

function shift(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const patients = [
  ['Amira Hassan', '555-0142', 'amira.hassan@email.com', '1988-04-12', 'Female', 'Prefers morning visits. Penicillin allergy.'],
  ['Jonah Ellis', '555-0177', 'jonah.ellis@email.com', '1975-11-02', 'Male', 'Follow-up for blood pressure.'],
  ['Priya Raman', '555-0190', 'priya.raman@email.com', '1992-07-19', 'Female', 'New patient. Referred by Dr. Okonkwo.'],
  ['Luis Ortega', '555-0118', 'luis.ortega@email.com', '1964-01-30', 'Male', 'Diabetic review every quarter.'],
  ['Hanae Suzuki', '555-0164', 'hanae.suzuki@email.com', '2001-09-08', 'Female', 'Sports clinic. Right knee strain.'],
  ['Omar Farouk', '555-0133', 'omar.farouk@email.com', '1983-12-21', 'Male', 'Annual physical due.'],
  ['Elena Varga', '555-0188', 'elena.varga@email.com', '1971-05-14', 'Female', 'Keeps a migraine diary in documents.'],
  ['Marcus Webb', '555-0126', 'marcus.webb@email.com', '1996-03-03', 'Male', 'Post-op suture check.'],
  ['Leila Nasser', '555-0151', 'leila.nasser@email.com', '1958-08-27', 'Female', 'Hearing check in progress.'],
  ['Theo Berg', '555-0104', 'theo.berg@email.com', '2014-02-11', 'Male', 'Pediatric. Guardian: Sara Berg.'],
];

const visits = [
  [-30, '11:00', '11:30', 'Luis Ortega', 'Quarterly diabetes review', 'completed', 'HbA1c 7.1. Diet unchanged.'],
  [-21, '09:00', '09:30', 'Amira Hassan', 'Intake', 'completed', 'Baseline pressure 128/82.'],
  [-18, '14:00', '14:40', 'Omar Farouk', 'Lab review', 'completed', 'Lipids improved. Repeat in six months.'],
  [-14, '15:00', '15:40', 'Elena Varga', 'Migraine plan', 'completed', 'Started preventative. Diary requested.'],
  [-12, '10:30', '11:00', 'Luis Ortega', 'Foot check', 'completed', 'Skin intact. Sensation reduced on the left.'],
  [-10, '13:30', '14:00', 'Leila Nasser', 'Hearing screen', 'completed', 'Mild loss on the right. Fitting discussed.'],
  [-7, '08:45', '09:15', 'Amira Hassan', 'Medication check', 'completed', 'Dose held. Morning readings steadier.'],
  [-6, '09:30', '09:50', 'Marcus Webb', 'Suture removal', 'completed', 'Wound clean. Keep it dry for two days.'],
  [-4, '15:30', '15:50', 'Theo Berg', 'School physical', 'completed', 'Cleared for sport. Guardian present.'],
  [-3, '16:00', '16:20', 'Elena Varga', 'Acute headache', 'completed', 'Resolved with usual rescue dose.'],
  [-1, '09:00', '09:20', 'Marcus Webb', 'Wound check', 'completed', 'Edges closed. No redness.'],
  [0, '08:30', '09:00', 'Amira Hassan', 'Blood pressure review', 'completed', '120/78. Continue the current dose.'],
  [0, '09:15', '09:45', 'Jonah Ellis', 'Hypertension follow-up', 'arrived', 'Waiting on this morning\'s reading.'],
  [0, '10:00', '10:45', 'Priya Raman', 'New patient intake', 'scheduled', 'Bring the referral letter.'],
  [0, '11:00', '11:40', 'Luis Ortega', 'Diabetes review', 'scheduled', 'Fasting sample already in the tray.'],
  [0, '13:00', '13:25', 'Hanae Suzuki', 'Knee assessment', 'scheduled', 'Swelling after Tuesday\'s match.'],
  [0, '14:30', '15:15', 'Omar Farouk', 'Annual physical', 'scheduled', ''],
  [0, '16:00', '16:30', 'Elena Varga', 'Migraine consult', 'cancelled', 'Called this morning to reschedule.'],
  [1, '10:00', '10:30', 'Priya Raman', 'Lab results', 'scheduled', ''],
  [1, '11:30', '11:50', 'Marcus Webb', 'Dressing change', 'scheduled', ''],
  [2, '09:00', '09:30', 'Omar Farouk', 'Blood draw', 'scheduled', 'Fasting.'],
  [2, '15:00', '15:30', 'Leila Nasser', 'Hearing aid fitting', 'scheduled', ''],
  [3, '13:10', '13:40', 'Hanae Suzuki', 'Physio follow-up', 'scheduled', ''],
  [4, '16:00', '16:20', 'Theo Berg', 'Vaccination', 'scheduled', 'Guardian will attend.'],
  [5, '08:40', '09:10', 'Jonah Ellis', 'Pressure check', 'scheduled', ''],
  [8, '11:15', '11:45', 'Luis Ortega', 'Diabetes review', 'scheduled', ''],
  [10, '09:00', '09:30', 'Amira Hassan', 'Follow-up', 'scheduled', ''],
];

const documents = [
  ['Hassan blood panel', 'Fasting panel from the last review.', 'Amira Hassan', 'Hassan-blood-panel.txt', 'Hemoglobin 13.4\nGlucose 96\nCholesterol 188\n'],
  ['Ellis consent form', 'Signed before the pressure clinic.', 'Jonah Ellis', 'Ellis-consent-form.txt', 'Consent for repeat blood pressure monitoring.\nSigned by Jonah Ellis.\n'],
  ['Raman referral letter', 'Referral from Dr. Okonkwo.', 'Priya Raman', 'Raman-referral.txt', 'Please assess fatigue and a new murmur.\nDr. Okonkwo\n'],
  ['Varga migraine diary', 'Two-week headache diary.', 'Elena Varga', 'Varga-migraine-diary.txt', 'Mon: mild, 4 hours\nThu: severe, aura, 9 hours\nSun: clear\n'],
  ['Clinic supply count', 'Front-desk copy. Not tied to a patient.', null, 'Clinic-supply-count.txt', 'Gloves: 4 boxes\nDressings: 2 boxes\nPeak flow meters: 3\n'],
];

async function connectWithRetry() {
  let lastError;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function runSetup() {
  const client = await connectWithRetry();
  fs.mkdirSync(uploadsDir, { recursive: true });
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(schema);

    const passwordFor = {
      admin: bcrypt.hashSync('admin123', 10),
      subadmin: bcrypt.hashSync('subadmin123', 10),
      user: bcrypt.hashSync('user123', 10),
    };
    const staff = await client.query(
      `
      INSERT INTO users (name, email, password_hash, role)
      VALUES
        ('Amina Farid', 'admin@halden.clinic', $1, 'admin'),
        ('Noah Keller', 'subadmin@halden.clinic', $2, 'sub-admin'),
        ('Sara Idris', 'user@halden.clinic', $3, 'user')
      RETURNING id, email
      `,
      [passwordFor.admin, passwordFor.subadmin, passwordFor.user],
    );
    const adminId = staff.rows.find((row) => row.email === 'admin@halden.clinic').id;
    const doctorPassword = bcrypt.hashSync('doctor123', 10);
    const doctors = [
      ['Maryam', 'maryam@halden.clinic', 'Physiotherapy'],
      ['Khadija', 'khadija@halden.clinic', 'Physiotherapy'],
      ['Rana', 'rana@halden.clinic', 'Occupational therapy'],
      ['Layla', 'layla@halden.clinic', 'Occupational therapy'],
      ['Nadia', 'nadia@halden.clinic', 'Speech therapy'],
      ['Samir', 'samir@halden.clinic', 'Speech therapy'],
    ];
    for (const [name, email, therapy] of doctors) {
      await client.query(
        `
        INSERT INTO users (name, email, password_hash, role, therapy_type)
        VALUES ($1, $2, $3, 'user', $4)
        `,
        [name, email, doctorPassword, therapy],
      );
    }

    const ids = {};
    for (const patient of patients) {
      const inserted = await client.query(
        `
        INSERT INTO patients (full_name, phone, email, date_of_birth, gender, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        `,
        patient,
      );
      ids[patient[0]] = inserted.rows[0].id;
    }

    for (const visit of visits) {
      const [offset, start, end, name, reason, status, notes] = visit;
      await client.query(
        `
        INSERT INTO reservations (
          patient_id, scheduled_date, start_time, end_time, reason, status, notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [ids[name], shift(offset), start, end, reason, status, notes || null, adminId],
      );
    }

    for (const document of documents) {
      const [name, description, patientName, fileName, body] = document;
      const storedName = `seed-${fileName}`;
      fs.writeFileSync(path.join(uploadsDir, storedName), body, 'utf8');
      await client.query(
        `
        INSERT INTO documents (name, description, patient_id, file_name, stored_name, mime_type, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, 'text/plain', $6)
        `,
        [name, description, patientName ? ids[patientName] : null, fileName, storedName, adminId],
      );
    }

    await seedInstruments((text, params) => client.query(text, params), adminId, uploadsDir);

    await client.query('COMMIT');
    console.log('PhysioCore demo desk is ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runSetup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runSetup };
