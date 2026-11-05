const express = require('express');

const { pool } = require('../db');
const { requireAuth } = require('../auth');
const { ensureTherapy } = require('../care');
const { actorFrom } = require('../scope');
const { asyncHandler, fail } = require('../http');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const actor = await actorFrom(req);
    let therapy = typeof req.query.therapy === 'string' ? req.query.therapy.trim() : '';
    if (actor.limited) therapy = actor.therapyType || '';
    if (therapy) therapy = await ensureTherapy(therapy);
    if (actor.limited && !therapy) {
      res.json({ doctors: [] });
      return;
    }
    const params = [];
    let where = 'WHERE therapy_type IS NOT NULL';
    if (therapy) {
      params.push(therapy);
      where += ' AND therapy_type = $1';
    }
    const { rows } = await pool.query(
      `
      SELECT id, name, therapy_type AS "therapyType"
      FROM users
      ${where}
      ORDER BY therapy_type, name
      `,
      params,
    );
    res.json({ doctors: rows });
  }),
);

module.exports = router;
