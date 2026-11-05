function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'sub-admin', 'user'];
const STATUSES = ['scheduled', 'arrived', 'completed', 'cancelled'];

function isDate(value) {
  return DATE.test(value || '');
}

function isTime(value) {
  return TIME.test(value || '');
}

function minutes(value) {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function localClock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function money(value, label) {
  if (value == null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw fail(400, `Enter a valid ${label.toLowerCase()}.`);
  return Math.round(amount * 100) / 100;
}

function wholeNumber(value, label) {
  if (value == null || value === '') return null;
  const amount = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number(value);
  if (!Number.isInteger(amount) || amount < 0) throw fail(400, `${label} has to be zero or more.`);
  return amount;
}

function text(value, max, label) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    throw fail(400, `${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

module.exports = {
  asyncHandler,
  fail,
  EMAIL,
  ROLES,
  STATUSES,
  isDate,
  isTime,
  minutes,
  localToday,
  localClock,
  money,
  wholeNumber,
  text,
};
