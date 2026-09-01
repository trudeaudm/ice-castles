const db = require('./db');
const { uuid, now } = require('./helpers');
const { ensureQuestStationsAll } = require('./questStations');

/**
 * Schema notes
 * ------------
 * - All primary keys are TEXT uuids so the same DDL works on SQLite and Postgres.
 * - Timestamps are ISO-8601 strings.
 * - Booleans are 0 / 1 integers.
 * - Map coordinates (x, y) are in *map image pixel space*, not lat/lng.
 * - Content is scoped: Location → Adventure (year). One adventure per location
 *   may be marked active; public short URLs resolve to that active package.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS locations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  venue_code  TEXT UNIQUE,
  region      TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS adventures (
  id               TEXT PRIMARY KEY,
  location_id      TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  year             INTEGER NOT NULL,
  is_active        INTEGER NOT NULL DEFAULT 0,
  welcome_headline TEXT,
  welcome_body     TEXT,
  hours_note       TEXT,
  safety_note      TEXT,
  map_image_url    TEXT,
  map_width        TEXT,
  map_height       TEXT,
  grid_cell        TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  "key"   TEXT PRIMARY KEY,
  "value" TEXT
);

CREATE TABLE IF NOT EXISTS pois (
  id           TEXT PRIMARY KEY,
  adventure_id TEXT REFERENCES adventures(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'landmark',
  zone         TEXT,
  blurb        TEXT,
  description  TEXT,
  fun_fact     TEXT,
  image_url    TEXT,
  x            REAL NOT NULL DEFAULT 0,
  y            REAL NOT NULL DEFAULT 0,
  scan_code    TEXT UNIQUE,
  published    INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunts (
  id           TEXT PRIMARY KEY,
  adventure_id TEXT REFERENCES adventures(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL,
  tagline      TEXT,
  description  TEXT,
  reward_title TEXT,
  reward_body  TEXT,
  reward_code  TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunt_stops (
  id               TEXT PRIMARY KEY,
  hunt_id          TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  poi_id           TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  token_name       TEXT NOT NULL,
  token_glyph      TEXT NOT NULL DEFAULT 'crystal',
  hint             TEXT,
  position         INTEGER NOT NULL DEFAULT 0,
  challenge_type   TEXT NOT NULL DEFAULT 'scan',
  challenge_config TEXT
);

CREATE TABLE IF NOT EXISTS guests (
  id           TEXT PRIMARY KEY,
  nickname     TEXT,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  visits       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS guest_scans (
  id         TEXT PRIMARY KEY,
  guest_id   TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  poi_id     TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  scanned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_tokens (
  id            TEXT PRIMARY KEY,
  guest_id      TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  hunt_id       TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  hunt_stop_id  TEXT NOT NULL REFERENCES hunt_stops(id) ON DELETE CASCADE,
  earned_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunt_completions (
  id           TEXT PRIMARY KEY,
  guest_id     TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  hunt_id      TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL,
  redeem_code  TEXT
);

CREATE TABLE IF NOT EXISTS touchpoints (
  id              TEXT PRIMARY KEY,
  adventure_id    TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  body            TEXT,
  discover_body   TEXT,
  element         TEXT,
  image_url       TEXT,
  audio_url       TEXT,
  poi_id          TEXT REFERENCES pois(id) ON DELETE SET NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  published       INTEGER NOT NULL DEFAULT 1,
  challenge_type  TEXT,
  config          TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_sessions (
  id                  TEXT PRIMARY KEY,
  guest_id            TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  adventure_id        TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  starting_station    TEXT,
  operating_date      TEXT NOT NULL,
  party_size          INTEGER,
  keeper_names        TEXT,
  email               TEXT,
  marketing_opt_in    INTEGER NOT NULL DEFAULT 0,
  heart_scanned_at    TEXT,
  quest_complete_at   TEXT,
  builders_visited_at TEXT,
  builder_quiz_at     TEXT,
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_realms (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES quest_sessions(id) ON DELETE CASCADE,
  realm        TEXT NOT NULL,
  station_id   TEXT,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_events (
  id            TEXT PRIMARY KEY,
  session_id    TEXT,
  guest_id      TEXT,
  adventure_id  TEXT,
  type          TEXT NOT NULL,
  station_slug  TEXT,
  payload       TEXT,
  user_agent    TEXT,
  created_at    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_scan_guest_poi   ON guest_scans (guest_id, poi_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_token_guest_stop ON guest_tokens (guest_id, hunt_stop_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_done_guest_hunt  ON hunt_completions (guest_id, hunt_id);
CREATE INDEX IF NOT EXISTS ix_stops_hunt   ON hunt_stops (hunt_id, position);
CREATE INDEX IF NOT EXISTS ix_pois_pub     ON pois (published, sort_order);
`;

const INDEX_DDL = `
CREATE INDEX IF NOT EXISTS ix_pois_adv     ON pois (adventure_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_hunts_adv    ON hunts (adventure_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_adv_loc      ON adventures (location_id, year);
CREATE UNIQUE INDEX IF NOT EXISTS ux_adv_loc_year ON adventures (location_id, year);
CREATE INDEX IF NOT EXISTS ix_touch_adv ON touchpoints (adventure_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS ux_touch_adv_slug ON touchpoints (adventure_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS ux_session_day ON quest_sessions (guest_id, adventure_id, operating_date);
CREATE UNIQUE INDEX IF NOT EXISTS ux_session_realm ON session_realms (session_id, realm);
CREATE INDEX IF NOT EXISTS ix_events_session ON quest_events (session_id, created_at);
CREATE INDEX IF NOT EXISTS ix_events_adv ON quest_events (adventure_id, type, created_at);
`;

const DEFAULT_SETTINGS = {
  // Legacy / global fallbacks only — adventure rows own live park copy.
  park_name: 'Ice Castles',
  location_name: 'North Woodstock, New Hampshire',
  welcome_headline: 'Find your way through the ice',
  welcome_body:
    'Tap any marker to learn what you are looking at. Scan the codes you find on the trail to collect light and unlock the reward at the Warming Hut.',
  map_image_url: '/assets/park-map.webp',
  map_width: '2000',
  map_height: '1400',
  grid_cell: '100',
  hours_note: 'Open nightly, weather permitting. Check the front gate for tonight’s closing time.',
  safety_note: 'Ice is uneven and slippery. Walk, don’t run, and keep little ones in reach.',
};

async function columnExists(table, column) {
  if (db.usingPostgres) {
    const row = await db.get(
      `SELECT 1 AS ok FROM information_schema.columns
        WHERE table_name = ? AND column_name = ?`,
      [table, column]
    );
    return Boolean(row);
  }
  const rows = await db.all(`PRAGMA table_info(${table})`);
  return rows.some((r) => r.name === column);
}

async function ensureColumn(table, column, ddlFragment) {
  if (await columnExists(table, column)) return;
  await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddlFragment}`);
}

/**
 * Lift a pre-tree install (flat settings + unscoped pois/hunts) into
 * Location → Adventure so existing parks keep working after deploy.
 */
async function ensureDefaultAdventure() {
  const existing = await db.get('SELECT id FROM locations LIMIT 1');
  if (existing) {
    // Attach any orphaned content left without an adventure_id.
    const active = await db.get(
      'SELECT id FROM adventures WHERE is_active = 1 ORDER BY year DESC LIMIT 1'
    );
    const fallback =
      active || (await db.get('SELECT id FROM adventures ORDER BY year DESC LIMIT 1'));
    if (fallback) {
      await db.run('UPDATE pois SET adventure_id = ? WHERE adventure_id IS NULL', [fallback.id]);
      await db.run('UPDATE hunts SET adventure_id = ? WHERE adventure_id IS NULL', [fallback.id]);
    }
    return fallback;
  }

  const settingsRows = await db.all('SELECT "key", "value" FROM settings');
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const ts = now();
  const locationId = uuid();
  const adventureId = uuid();
  const year = new Date().getFullYear();

  await db.run(
    `INSERT INTO locations (id, name, slug, venue_code, region, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      locationId,
      settings.park_name || 'Ice Castles',
      'NHAdventure',
      'nh',
      settings.location_name || 'North Woodstock, New Hampshire',
      ts,
      ts,
    ]
  );

  await db.run(
    `INSERT INTO adventures
       (id, location_id, name, year, is_active,
        welcome_headline, welcome_body, hours_note, safety_note,
        map_image_url, map_width, map_height, grid_cell,
        created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      adventureId,
      locationId,
      `${year} NH Adventure`,
      year,
      1,
      settings.welcome_headline || DEFAULT_SETTINGS.welcome_headline,
      settings.welcome_body || DEFAULT_SETTINGS.welcome_body,
      settings.hours_note || DEFAULT_SETTINGS.hours_note,
      settings.safety_note || DEFAULT_SETTINGS.safety_note,
      settings.map_image_url || DEFAULT_SETTINGS.map_image_url,
      settings.map_width || DEFAULT_SETTINGS.map_width,
      settings.map_height || DEFAULT_SETTINGS.map_height,
      settings.grid_cell || DEFAULT_SETTINGS.grid_cell,
      ts,
      ts,
    ]
  );

  await db.run('UPDATE pois SET adventure_id = ? WHERE adventure_id IS NULL', [adventureId]);
  await db.run('UPDATE hunts SET adventure_id = ? WHERE adventure_id IS NULL', [adventureId]);
  return { id: adventureId };
}

async function migrate() {
  await db.exec(DDL);

  // Upgrades from the pre-tree schema — columns before indexes that need them.
  await ensureColumn('pois', 'adventure_id', 'adventure_id TEXT');
  await ensureColumn('hunts', 'adventure_id', 'adventure_id TEXT');
  await ensureColumn('hunt_stops', 'challenge_type', "challenge_type TEXT NOT NULL DEFAULT 'scan'");
  await ensureColumn('hunt_stops', 'challenge_config', 'challenge_config TEXT');
  await ensureColumn('adventures', 'badge_title', 'badge_title TEXT');
  await ensureColumn('adventures', 'badge_body', 'badge_body TEXT');
  await ensureColumn('adventures', 'badge_redemption', 'badge_redemption TEXT');
  await ensureColumn('locations', 'venue_code', 'venue_code TEXT');
  await ensureColumn('touchpoints', 'discover_body', 'discover_body TEXT');
  await ensureColumn('touchpoints', 'challenge_type', 'challenge_type TEXT');

  await db.exec(INDEX_DDL);

  const nh = await db.get('SELECT id FROM locations WHERE slug = ?', ['NHAdventure']);
  const nhTaken = await db.get(`SELECT id FROM locations WHERE venue_code = 'nh'`);
  if (nh && !nhTaken) {
    await db.run('UPDATE locations SET venue_code = ? WHERE id = ?', ['nh', nh.id]);
  } else if (nh && nhTaken && nhTaken.id === nh.id) {
    /* already nh */
  } else if (!nhTaken) {
    const first = await db.get('SELECT id FROM locations ORDER BY created_at LIMIT 1');
    if (first) {
      await db.run('UPDATE locations SET venue_code = ? WHERE id = ?', ['nh', first.id]);
    }
  }
  const uncoded = await db.all(
    `SELECT id, slug FROM locations WHERE venue_code IS NULL OR venue_code = ''`
  );
  for (const loc of uncoded) {
    const code = String(loc.slug || 'venue')
      .toLowerCase()
      .replace(/adventure$/i, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 8) || 'venue';
    await db.run('UPDATE locations SET venue_code = ? WHERE id = ?', [code, loc.id]);
  }

  const ts = now();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.run(
      'INSERT INTO settings ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO NOTHING',
      [key, value]
    );
  }

  await db.run(
    `UPDATE settings SET value = ? WHERE "key" = 'map_image_url' AND value = ?`,
    ['/assets/park-map.webp', '/assets/park-map.svg']
  );

  await ensureDefaultAdventure();
  await ensureQuestStationsAll();
  return ts;
}

module.exports = { migrate, DEFAULT_SETTINGS };
