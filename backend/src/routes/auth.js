const express = require('express');
const bcrypt = require('bcryptjs');

const { pool } = require('../db');
const { requireAuth, signToken } = require('../auth');
const { asyncHandler, fail, EMAIL } = require('../http');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      throw fail(400, 'Enter your email and password.');
    }

    const { rows } = await pool.query(
      'SELECT id, name, email, phone, role, therapy_type AS "therapyType", password_hash FROM users WHERE email = $1',
      [email],
    );
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      throw fail(401, 'Email or password is not right.');
    }

    const safe = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      therapyType: user.therapyType,
    };
    res.json({ token: signToken(safe), user: safe });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, role, therapy_type AS "therapyType" FROM users WHERE id = $1',
      [req.user.id],
    );
    if (!rows[0]) {
      throw fail(401, 'Sign in required.');
    }
    res.json({ user: rows[0] });
  }),
);

module.exports = router;
module.exports.EMAIL = EMAIL;
