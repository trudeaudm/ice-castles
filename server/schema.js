const db = require('./db');

/**
 * Schema notes
 * ------------
 * - All primary keys are TEXT uuids so the same DDL works on SQLite and Postgres.
 * - Timestamps are ISO-8601 strings.
 * - Booleans are 0 / 1 integers.
 * - Map coordinates (x, y) are in *map image pixel space*, not lat/lng. The
 *   client renders the park map with Leaflet's CRS.Simple, so a POI at
 *   x=1200 y=800 sits at that pixel of the map artwork at any zoom level.
 *   Swapping in new artwork of the same aspect ratio keeps every pin correct.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS settings (
  "key"   TEXT PRIMARY KEY,
  "value" TEXT
);

CREATE TABLE IF NOT EXISTS pois (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  category    TEXT NOT NULL DEFAULT 'landmark',
  zone        TEXT,
  blurb       TEXT,
  description TEXT,
  fun_fact    TEXT,
  image_url   TEXT,
  x           REAL NOT NULL DEFAULT 0,
  y           REAL NOT NULL DEFAULT 0,
  scan_code   TEXT UNIQUE,
  published   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunts (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
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
  id          TEXT PRIMARY KEY,
  hunt_id     TEXT NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
  poi_id      TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  token_name  TEXT NOT NULL,
  token_glyph TEXT NOT NULL DEFAULT 'crystal',
  hint        TEXT,
  position    INTEGER NOT NULL DEFAULT 0
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

CREATE UNIQUE INDEX IF NOT EXISTS ux_scan_guest_poi   ON guest_scans (guest_id, poi_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_token_guest_stop ON guest_tokens (guest_id, hunt_stop_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_done_guest_hunt  ON hunt_completions (guest_id, hunt_id);
CREATE INDEX IF NOT EXISTS ix_stops_hunt   ON hunt_stops (hunt_id, position);
CREATE INDEX IF NOT EXISTS ix_pois_pub     ON pois (published, sort_order);
`;

const DEFAULT_SETTINGS = {
  park_name: 'Ice Castles',
  location_name: 'North Woodstock, New Hampshire',
  welcome_headline: 'Find your way through the ice',
  welcome_body:
    'Tap any marker to learn what you are looking at. Scan the codes you find on the trail to collect light and unlock the reward at the Warming Hut.',
  map_image_url: '/assets/park-map.svg',
  map_width: '2000',
  map_height: '1400',
  grid_cell: '100',
  hours_note: 'Open nightly, weather permitting. Check the front gate for tonight’s closing time.',
  safety_note: 'Ice is uneven and slippery. Walk, don’t run, and keep little ones in reach.',
};

async function migrate() {
  await db.exec(DDL);
  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.run(
      'INSERT INTO settings ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO NOTHING',
      [key, value]
    );
  }
  return now;
}

module.exports = { migrate, DEFAULT_SETTINGS };
