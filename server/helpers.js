const crypto = require('crypto');

const uuid = () => crypto.randomUUID();

/** Unambiguous alphabet: no 0/O, no 1/I/L. Safe to read aloud over a radio. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function shortCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function slugify(input, fallback = 'item') {
  const slug = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || `${fallback}-${shortCode(4).toLowerCase()}`;
}

const now = () => new Date().toISOString();

/** Coerce anything to a finite number, else fall back. */
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const bool = (value) => (value ? 1 : 0);

function clean(value, max = 4000) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

module.exports = { uuid, shortCode, slugify, now, num, bool, clean };
