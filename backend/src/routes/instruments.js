const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const { pool } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { asyncHandler, fail, localToday, money, text } = require('../http');
const { ensureTherapy } = require('../care');
const { actorFrom, assertDomain } = require('../scope');
const { uploadsDir } = require('../paths');

const IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
      callback(null, `${Date.now()}-${safe || 'instrument'}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!IMAGES.has(file.mimetype)) {
      callback(fail(400, 'Use a PNG, JPEG, WebP, or GIF image.'));
      return;
    }
    callback(null, true);
  },
});

const router = express.Router();
router.use(requireAuth);

const instrumentSelect = `
  SELECT
    i.id,
    i.therapy_type AS "therapyType",
    i.name,
    i.used_for AS "usedFor",
    i.file_name AS "fileName",
    i.stored_name AS "storedName",
    i.mime_type AS "mimeType",
    i.price::float8 AS price,
    u.name AS "addedByName",
    i.created_at AS "createdAt"
  FROM instruments i
  LEFT JOIN users u ON u.id = i.added_by
`;

function publicInstrument(row) {
  const { storedName, ...instrument } = row;
  return { ...instrument, hasImage: Boolean(storedName) };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    if (actor.limited && !actor.therapyType) {
      res.json({ instruments: [] });
      return;
    }
    let therapy = text(req.query.therapy, 80, 'Therapy');
    if (therapy) therapy = await ensureTherapy(therapy);
    if (actor.limited) therapy = actor.therapyType;
    const { rows } = await pool.query(
      `
      ${instrumentSelect}
      WHERE ($1::text IS NULL OR i.therapy_type = $1)
      ORDER BY i.therapy_type, i.name
      `,
      [therapy],
    );
    res.json({ instruments: rows.map(publicInstrument) });
  }),
);

router.post(
  '/',
  (req, res, next) => {
    upload.single('image')(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Images must be 8 MB or smaller.' });
      }
      if (error.status) return res.status(error.status).json({ error: error.message });
      return next(error);
    });
  },
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    const name = text(req.body.name, 160, 'Name');
    const usedFor = text(req.body.usedFor, 2000, 'Used for');
    let therapyType = text(req.body.therapyType, 80, 'Therapy');
    if (actor.limited) therapyType = actor.therapyType;
    therapyType = await ensureTherapy(therapyType);
    if (!therapyType) throw fail(400, 'Choose a therapy type.');
    if (!name) throw fail(400, 'Name the instrument.');
    if (!usedFor) throw fail(400, 'Say what the instrument is used for.');
    if (!req.file) throw fail(400, 'Add a photo of the instrument.');
    const price = money(req.body.price, 'Price');
    const { rows } = await pool.query(
      `
      INSERT INTO instruments (therapy_type, name, used_for, price, priced_on, file_name, stored_name, mime_type, added_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
      `,
      [
        therapyType,
        name,
        usedFor,
        price,
        price == null ? null : localToday(),
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.user.id,
      ],
    );
    const created = await pool.query(`${instrumentSelect} WHERE i.id = $1`, [rows[0].id]);
    res.status(201).json({ instrument: publicInstrument(created.rows[0]) });
  }),
);

router.get(
  '/:id/image',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT stored_name, mime_type, therapy_type AS "therapyType" FROM instruments WHERE id = $1',
      [req.params.id],
    );
    const row = rows[0];
    if (!row || !row.stored_name) throw fail(404, 'That instrument has no photo.');
    assertDomain(await actorFrom(req), row.therapyType);
    const full = path.resolve(uploadsDir, path.basename(row.stored_name));
    if (!full.startsWith(path.resolve(uploadsDir))) throw fail(400, 'Cannot open that file.');
    if (!fs.existsSync(full)) throw fail(404, 'The photo is missing from the server.');
    res.type(row.mime_type || 'image/jpeg');
    res.sendFile(full);
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const price = money(req.body.price, 'Price');
    const { rows } = await pool.query(
      `
      UPDATE instruments
      SET price = $1,
          priced_on = CASE
            WHEN $1::numeric IS NULL THEN NULL
            WHEN priced_on IS NULL THEN $2::date
            ELSE priced_on
          END
      WHERE id = $3
      RETURNING id
      `,
      [price, localToday(), req.params.id],
    );
    if (!rows[0]) throw fail(404, 'Instrument not found.');
    const updated = await pool.query(`${instrumentSelect} WHERE i.id = $1`, [rows[0].id]);
    res.json({ instrument: publicInstrument(updated.rows[0]) });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'DELETE FROM instruments WHERE id = $1 RETURNING stored_name',
      [req.params.id],
    );
    if (!rows[0]) throw fail(404, 'Instrument not found.');
    if (rows[0].stored_name) {
      const full = path.resolve(uploadsDir, path.basename(rows[0].stored_name));
      if (full.startsWith(path.resolve(uploadsDir)) && fs.existsSync(full)) fs.unlinkSync(full);
    }
    res.json({ ok: true });
  }),
);

module.exports = router;
