const { pool } = require('./db');
const { fail } = require('./http');

const THERAPY_EXPR = `
  COALESCE(
    p.therapy_type,
    doc.therapy_type,
    CASE
      WHEN r.reason IN (SELECT name FROM therapies) THEN r.reason
      ELSE NULL
    END
  )
`;

async function actorFrom(req) {
  const { rows } = await pool.query(
    'SELECT id, role, therapy_type AS "therapyType" FROM users WHERE id = $1',
    [req.user.id],
  );
  const row = rows[0];
  if (!row) throw fail(401, 'Sign in required.');
  return {
    id: row.id,
    role: row.role,
    therapyType: row.therapyType || null,
    limited: row.role === 'user',
  };
}

function domainTherapy(actor) {
  if (!actor.limited) return null;
  return actor.therapyType;
}

function assertDomain(actor, therapy) {
  if (!actor.limited) return;
  if (!actor.therapyType || therapy !== actor.therapyType) {
    throw fail(403, 'That record is outside your therapy.');
  }
}

module.exports = { THERAPY_EXPR, actorFrom, domainTherapy, assertDomain };
