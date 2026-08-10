const db = require('./db');
const { uuid, now, clean, num, bool, slugify, shortCode } = require('./helpers');

const CHALLENGE_TYPES = ['scan', 'acknowledge', 'code_entry', 'multiple_choice', 'reflection'];

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function serializeConfig(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify({ value });
    }
  }
  return JSON.stringify(value);
}

function normalizeChallengeType(value) {
  const t = String(value || 'scan').toLowerCase();
  return CHALLENGE_TYPES.includes(t) ? t : 'scan';
}

/** Resolve location slug (+ optional year) to the adventure package guests see. */
async function resolveAdventure({ locationSlug, year } = {}) {
  if (!locationSlug) {
    return db.get(
      `SELECT a.*, l.name AS location_name, l.slug AS location_slug, l.region
         FROM adventures a JOIN locations l ON l.id = a.location_id
        WHERE a.is_active = 1
        ORDER BY a.year DESC LIMIT 1`
    );
  }

  const location = await db.get('SELECT * FROM locations WHERE slug = ?', [locationSlug]);
  if (!location) return null;

  if (year) {
    const byYear = await db.get(
      `SELECT a.*, l.name AS location_name, l.slug AS location_slug, l.region
         FROM adventures a JOIN locations l ON l.id = a.location_id
        WHERE a.location_id = ? AND a.year = ?`,
      [location.id, Number(year)]
    );
    if (byYear) return byYear;
  }

  const active = await db.get(
    `SELECT a.*, l.name AS location_name, l.slug AS location_slug, l.region
       FROM adventures a JOIN locations l ON l.id = a.location_id
      WHERE a.location_id = ? AND a.is_active = 1
      ORDER BY a.year DESC LIMIT 1`,
    [location.id]
  );
  if (active) return active;

  return db.get(
    `SELECT a.*, l.name AS location_name, l.slug AS location_slug, l.region
       FROM adventures a JOIN locations l ON l.id = a.location_id
      WHERE a.location_id = ?
      ORDER BY a.year DESC LIMIT 1`,
    [location.id]
  );
}

async function adventureById(id) {
  return db.get(
    `SELECT a.*, l.name AS location_name, l.slug AS location_slug, l.region
       FROM adventures a JOIN locations l ON l.id = a.location_id
      WHERE a.id = ?`,
    [id]
  );
}

function publicAdventure(row) {
  return {
    id: row.id,
    name: row.name,
    year: Number(row.year),
    isActive: row.is_active === 1 || row.is_active === true,
    locationId: row.location_id,
    locationName: row.location_name,
    locationSlug: row.location_slug,
    region: row.region,
    path: `/${row.location_slug}`,
    yearPath: `/${row.location_slug}/${row.year}`,
  };
}

function parkFromAdventure(row) {
  return {
    name: row.location_name,
    locationName: row.region || '',
    adventureName: row.name,
    year: Number(row.year),
    welcomeHeadline: row.welcome_headline,
    welcomeBody: row.welcome_body,
    hoursNote: row.hours_note,
    safetyNote: row.safety_note,
  };
}

function mapFromAdventure(row) {
  return {
    imageUrl: row.map_image_url || '/assets/park-map.webp',
    width: Number(row.map_width) || 2000,
    height: Number(row.map_height) || 1400,
    gridCell: Number(row.grid_cell) || 100,
  };
}

async function listTree() {
  const locations = await db.all('SELECT * FROM locations ORDER BY name');
  const adventures = await db.all('SELECT * FROM adventures ORDER BY year DESC');
  return locations.map((loc) => ({
    ...loc,
    adventures: adventures.filter((a) => a.location_id === loc.id),
  }));
}

/** Make this adventure the sole active package for its location. */
async function setActiveAdventure(adventureId) {
  const adventure = await db.get('SELECT * FROM adventures WHERE id = ?', [adventureId]);
  if (!adventure) return null;
  await db.run('UPDATE adventures SET is_active = 0, updated_at = ? WHERE location_id = ?', [
    now(),
    adventure.location_id,
  ]);
  await db.run('UPDATE adventures SET is_active = 1, updated_at = ? WHERE id = ?', [
    now(),
    adventureId,
  ]);
  return adventureById(adventureId);
}

async function createLocation({ name, slug, region }) {
  const id = uuid();
  const ts = now();
  const finalSlug = slugify(slug || name, 'location');
  await db.run(
    `INSERT INTO locations (id, name, slug, region, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [id, clean(name, 120) || 'New location', finalSlug, clean(region, 160), ts, ts]
  );
  return db.get('SELECT * FROM locations WHERE id = ?', [id]);
}

async function createAdventure(locationId, fields = {}) {
  const location = await db.get('SELECT * FROM locations WHERE id = ?', [locationId]);
  if (!location) return null;
  const ts = now();
  const id = uuid();
  const year = num(fields.year, new Date().getFullYear());
  const name = clean(fields.name, 120) || `${year} ${location.name}`;
  const others = await db.get(
    'SELECT COUNT(*) AS n FROM adventures WHERE location_id = ?',
    [locationId]
  );
  const makeActive = fields.is_active === undefined ? Number(others.n) === 0 : Boolean(fields.is_active);

  if (makeActive) {
    await db.run('UPDATE adventures SET is_active = 0, updated_at = ? WHERE location_id = ?', [
      ts,
      locationId,
    ]);
  }

  await db.run(
    `INSERT INTO adventures
       (id, location_id, name, year, is_active,
        welcome_headline, welcome_body, hours_note, safety_note,
        map_image_url, map_width, map_height, grid_cell,
        created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      locationId,
      name,
      year,
      makeActive ? 1 : 0,
      clean(fields.welcome_headline, 120),
      clean(fields.welcome_body, 2000),
      clean(fields.hours_note, 600),
      clean(fields.safety_note, 600),
      clean(fields.map_image_url, 500) || '/assets/park-map.webp',
      String(fields.map_width || 2000),
      String(fields.map_height || 1400),
      String(fields.grid_cell || 100),
      ts,
      ts,
    ]
  );
  return adventureById(id);
}

async function updateAdventure(id, patch = {}) {
  const existing = await db.get('SELECT * FROM adventures WHERE id = ?', [id]);
  if (!existing) return null;

  const pick = (key, max) =>
    patch[key] !== undefined ? clean(patch[key], max) : existing[key];

  await db.run(
    `UPDATE adventures SET
       name=?, year=?, welcome_headline=?, welcome_body=?, hours_note=?, safety_note=?,
       map_image_url=?, map_width=?, map_height=?, grid_cell=?, updated_at=?
     WHERE id=?`,
    [
      pick('name', 120) || existing.name,
      patch.year !== undefined ? num(patch.year, existing.year) : existing.year,
      pick('welcome_headline', 120),
      pick('welcome_body', 2000),
      pick('hours_note', 600),
      pick('safety_note', 600),
      pick('map_image_url', 500) || existing.map_image_url,
      patch.map_width !== undefined ? String(patch.map_width) : existing.map_width,
      patch.map_height !== undefined ? String(patch.map_height) : existing.map_height,
      patch.grid_cell !== undefined ? String(patch.grid_cell) : existing.grid_cell,
      now(),
      id,
    ]
  );

  if (patch.is_active) await setActiveAdventure(id);
  return adventureById(id);
}

/**
 * Award a hunt stop to a guest. Shared by QR scan (scan-type stops) and
 * POST /api/challenge (acknowledge / code / quiz / reflection).
 */
async function awardStop(guestId, stop, ts = now()) {
  const existingToken = await db.get(
    'SELECT id FROM guest_tokens WHERE guest_id = ? AND hunt_stop_id = ?',
    [guestId, stop.id]
  );
  if (existingToken) {
    return { already: true, awards: [], completed: [] };
  }

  await db.run(
    'INSERT INTO guest_tokens (id, guest_id, hunt_id, hunt_stop_id, earned_at) VALUES (?, ?, ?, ?, ?)',
    [uuid(), guestId, stop.hunt_id, stop.id, ts]
  );

  const total = await db.get(
    `SELECT COUNT(*) AS n FROM hunt_stops s JOIN pois p ON p.id = s.poi_id
      WHERE s.hunt_id = ? AND p.published = 1`,
    [stop.hunt_id]
  );
  const earned = await db.get(
    'SELECT COUNT(*) AS n FROM guest_tokens WHERE guest_id = ? AND hunt_id = ?',
    [guestId, stop.hunt_id]
  );

  const earnedCount = Number(earned.n);
  const totalCount = Number(total.n);
  const awards = [
    {
      huntId: stop.hunt_id,
      huntTitle: stop.hunt_title,
      stopId: stop.id,
      tokenName: stop.token_name,
      tokenGlyph: stop.token_glyph,
      earnedCount,
      totalCount,
    },
  ];
  const completed = [];

  if (totalCount > 0 && earnedCount >= totalCount) {
    const already = await db.get(
      'SELECT id, redeem_code FROM hunt_completions WHERE guest_id = ? AND hunt_id = ?',
      [guestId, stop.hunt_id]
    );
    const redeemCode = already?.redeem_code || stop.reward_code || null;
    if (!already) {
      await db.run(
        'INSERT INTO hunt_completions (id, guest_id, hunt_id, completed_at, redeem_code) VALUES (?, ?, ?, ?, ?)',
        [uuid(), guestId, stop.hunt_id, ts, redeemCode]
      );
    }
    completed.push({
      huntId: stop.hunt_id,
      huntTitle: stop.hunt_title,
      rewardTitle: stop.reward_title,
      rewardBody: stop.reward_body,
      redeemCode,
    });
  }

  return { already: false, awards, completed };
}

function validateChallengeAnswer(type, config, answer) {
  const cfg = parseConfig(config);
  switch (type) {
    case 'acknowledge':
      return { ok: true };
    case 'reflection': {
      const text = String(answer?.text || answer || '').trim();
      if (!text) return { ok: false, error: 'empty_reflection' };
      return { ok: true };
    }
    case 'code_entry': {
      const expected = String(cfg.code || '').trim().toUpperCase();
      const got = String(answer?.code || answer || '')
        .trim()
        .toUpperCase();
      if (!expected || got !== expected) return { ok: false, error: 'bad_code' };
      return { ok: true };
    }
    case 'multiple_choice': {
      const correct = Number(cfg.correctIndex);
      const got = Number(answer?.choiceIndex ?? answer);
      if (!Number.isFinite(got) || got !== correct) return { ok: false, error: 'bad_choice' };
      return { ok: true };
    }
    default:
      return { ok: false, error: 'wrong_type' };
  }
}

function publicChallengeConfig(type, config) {
  const cfg = parseConfig(config);
  switch (type) {
    case 'acknowledge':
      return { prompt: cfg.prompt || 'Mark this stop complete when you find it.' };
    case 'reflection':
      return { prompt: cfg.prompt || 'What will you remember from this stop?' };
    case 'code_entry':
      return { prompt: cfg.prompt || 'Enter the code at this stop.' };
    case 'multiple_choice':
      return {
        question: cfg.question || 'Choose the right answer.',
        choices: Array.isArray(cfg.choices) ? cfg.choices : [],
      };
    default:
      return {};
  }
}

module.exports = {
  CHALLENGE_TYPES,
  parseConfig,
  serializeConfig,
  normalizeChallengeType,
  resolveAdventure,
  adventureById,
  publicAdventure,
  parkFromAdventure,
  mapFromAdventure,
  listTree,
  setActiveAdventure,
  createLocation,
  createAdventure,
  updateAdventure,
  awardStop,
  validateChallengeAnswer,
  publicChallengeConfig,
  shortCode,
  bool,
};
