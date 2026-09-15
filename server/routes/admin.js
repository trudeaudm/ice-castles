const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { uuid, shortCode, slugify, now, num, bool, clean } = require('../helpers');
const {
  listTree,
  createLocation,
  createAdventure,
  updateAdventure,
  setActiveAdventure,
  adventureById,
  serializeConfig,
  normalizeChallengeType,
  CHALLENGE_TYPES,
} = require('../adventures');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'letmein';

function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '') || String(req.query.token || '');
  if (token && token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'unauthorized' });
}

router.post('/login', (req, res) => {
  if (String(req.body?.password || '') === ADMIN_PASSWORD) {
    return res.json({ token: ADMIN_PASSWORD });
  }
  res.status(401).json({ error: 'bad_password' });
});

router.use(requireAdmin);

async function requireAdventureId(req) {
  const id = clean(req.query.adventure_id || req.body?.adventure_id, 80);
  if (!id) return null;
  return adventureById(id);
}

/* ---------------------------- tree + state ---------------------------- */

router.get('/tree', async (_req, res) => {
  res.json({ locations: await listTree() });
});

router.get('/state', async (req, res) => {
  const adventureId = clean(req.query.adventure_id, 80);
  let adventure = adventureId ? await adventureById(adventureId) : null;
  if (!adventure) {
    adventure = await db.get(
      `SELECT a.*, l.name AS location_name, l.slug AS location_slug, l.venue_code, l.region
         FROM adventures a JOIN locations l ON l.id = a.location_id
        WHERE a.is_active = 1 ORDER BY a.year DESC LIMIT 1`
    );
  }
  if (!adventure) {
    return res.json({
      tree: await listTree(),
      adventure: null,
      settings: {},
      pois: [],
      hunts: [],
    });
  }

  const pois = await db.all(
    'SELECT * FROM pois WHERE adventure_id = ? ORDER BY sort_order, name',
    [adventure.id]
  );
  const hunts = await db.all(
    'SELECT * FROM hunts WHERE adventure_id = ? ORDER BY sort_order, created_at',
    [adventure.id]
  );
  const stops = hunts.length
    ? await db.all(
        `SELECT * FROM hunt_stops WHERE hunt_id IN (${hunts.map(() => '?').join(',')}) ORDER BY position`,
        hunts.map((h) => h.id)
      )
    : [];
  const touchpoints = await db.all(
    'SELECT * FROM touchpoints WHERE adventure_id = ? ORDER BY sort_order, created_at',
    [adventure.id]
  );

  res.json({
    tree: await listTree(),
    adventure,
    settings: {
      park_name: adventure.location_name,
      location_name: adventure.region || '',
      welcome_headline: adventure.welcome_headline || '',
      welcome_body: adventure.welcome_body || '',
      hours_note: adventure.hours_note || '',
      safety_note: adventure.safety_note || '',
      map_image_url: adventure.map_image_url || '/assets/park-map.webp',
      map_width: adventure.map_width || '2000',
      map_height: adventure.map_height || '1400',
      grid_cell: adventure.grid_cell || '100',
      badge_title: adventure.badge_title || '',
      badge_body: adventure.badge_body || '',
      badge_redemption: adventure.badge_redemption || '',
    },
    pois,
    hunts: hunts.map((h) => ({ ...h, stops: stops.filter((s) => s.hunt_id === h.id) })),
    touchpoints,
  });
});

router.get('/stats', async (req, res) => {
  const adventureId = clean(req.query.adventure_id, 80);
  const poiFilter = adventureId ? 'WHERE p.adventure_id = ?' : '';
  const huntFilter = adventureId ? 'WHERE h.adventure_id = ?' : '';
  const poiParams = adventureId ? [adventureId] : [];
  const huntParams = adventureId ? [adventureId] : [];

  const [guests, scans, perPoi, perHunt] = await Promise.all([
    db.get('SELECT COUNT(*) AS n FROM guests'),
    adventureId
      ? db.get(
          `SELECT COUNT(*) AS n FROM guest_scans s JOIN pois p ON p.id = s.poi_id WHERE p.adventure_id = ?`,
          [adventureId]
        )
      : db.get('SELECT COUNT(*) AS n FROM guest_scans'),
    db.all(
      `SELECT p.id, p.name, COUNT(s.id) AS scans
         FROM pois p LEFT JOIN guest_scans s ON s.poi_id = p.id
        ${poiFilter}
        GROUP BY p.id, p.name ORDER BY scans DESC, p.name`,
      poiParams
    ),
    db.all(
      `SELECT h.id, h.title, COUNT(c.id) AS completions
         FROM hunts h LEFT JOIN hunt_completions c ON c.hunt_id = h.id
        ${huntFilter}
        GROUP BY h.id, h.title ORDER BY completions DESC, h.title`,
      huntParams
    ),
  ]);
  res.json({
    guests: Number(guests.n),
    scans: Number(scans.n),
    perPoi: perPoi.map((r) => ({ ...r, scans: Number(r.scans) })),
    perHunt: perHunt.map((r) => ({ ...r, completions: Number(r.completions) })),
  });
});

/* ------------------------- locations / adventures ------------------------- */

router.post('/locations', async (req, res) => {
  const loc = await createLocation(req.body || {});
  res.status(201).json(loc);
});

router.patch('/locations/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM locations WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const name = b.name !== undefined ? clean(b.name, 120) || existing.name : existing.name;
  const slug =
    b.slug !== undefined
      ? slugify(b.slug || name, 'location')
      : existing.slug;
  const venueCode = b.venue_code !== undefined
    ? slugify(b.venue_code || slug, 'nh').replace(/-/g, '').slice(0, 8)
    : existing.venue_code;
  await db.run(
    'UPDATE locations SET name=?, slug=?, venue_code=?, region=?, updated_at=? WHERE id=?',
    [name, slug, venueCode, b.region !== undefined ? clean(b.region, 160) : existing.region, now(), existing.id]
  );
  res.json(await db.get('SELECT * FROM locations WHERE id = ?', [existing.id]));
});

router.post('/locations/:id/adventures', async (req, res) => {
  const adventure = await createAdventure(req.params.id, req.body || {});
  if (!adventure) return res.status(404).json({ error: 'location_not_found' });
  res.status(201).json(adventure);
});

router.patch('/adventures/:id', async (req, res) => {
  const adventure = await updateAdventure(req.params.id, req.body || {});
  if (!adventure) return res.status(404).json({ error: 'not_found' });
  res.json(adventure);
});

router.post('/adventures/:id/activate', async (req, res) => {
  const adventure = await setActiveAdventure(req.params.id);
  if (!adventure) return res.status(404).json({ error: 'not_found' });
  res.json(adventure);
});

/* -------------------------------- settings ------------------------------- */

router.put('/settings', async (req, res) => {
  const adventureId = clean(req.body?.adventure_id, 80);
  if (!adventureId) return res.status(400).json({ error: 'missing_adventure' });
  const patch = { ...req.body };
  delete patch.adventure_id;

  const adventure = await updateAdventure(adventureId, {
    welcome_headline: patch.welcome_headline,
    welcome_body: patch.welcome_body,
    hours_note: patch.hours_note,
    safety_note: patch.safety_note,
    map_image_url: patch.map_image_url,
    map_width: patch.map_width,
    map_height: patch.map_height,
    grid_cell: patch.grid_cell,
    badge_title: patch.badge_title,
    badge_body: patch.badge_body,
    badge_redemption: patch.badge_redemption,
  });
  if (!adventure) return res.status(404).json({ error: 'not_found' });

  if (patch.park_name !== undefined || patch.location_name !== undefined) {
    const loc = await db.get('SELECT * FROM locations WHERE id = ?', [adventure.location_id]);
    if (loc) {
      await db.run(
        'UPDATE locations SET name=?, region=?, updated_at=? WHERE id=?',
        [
          patch.park_name !== undefined ? clean(patch.park_name, 120) || loc.name : loc.name,
          patch.location_name !== undefined ? clean(patch.location_name, 160) : loc.region,
          now(),
          loc.id,
        ]
      );
    }
  }

  const fresh = await adventureById(adventureId);
  res.json({
    park_name: fresh.location_name,
    location_name: fresh.region || '',
    welcome_headline: fresh.welcome_headline || '',
    welcome_body: fresh.welcome_body || '',
    hours_note: fresh.hours_note || '',
    safety_note: fresh.safety_note || '',
    map_image_url: fresh.map_image_url || '/assets/park-map.webp',
    map_width: fresh.map_width || '2000',
    map_height: fresh.map_height || '1400',
    grid_cell: fresh.grid_cell || '100',
    badge_title: fresh.badge_title || '',
    badge_body: fresh.badge_body || '',
    badge_redemption: fresh.badge_redemption || '',
  });
});

/* ------------------------------ points of interest ----------------------- */

async function uniqueSlug(adventureId, name, ignoreId = null) {
  let base = slugify(name, 'poi');
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const clash = await db.get(
      'SELECT id FROM pois WHERE adventure_id = ? AND slug = ?',
      [adventureId, candidate]
    );
    if (!clash || clash.id === ignoreId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${shortCode(4).toLowerCase()}`;
}

async function uniqueScanCode() {
  for (let i = 0; i < 50; i++) {
    const code = shortCode(6);
    const clash = await db.get('SELECT id FROM pois WHERE scan_code = ?', [code]);
    if (!clash) return code;
  }
  return shortCode(10);
}

router.post('/pois', async (req, res) => {
  const b = req.body || {};
  const adventureId = clean(b.adventure_id, 80);
  if (!adventureId) return res.status(400).json({ error: 'missing_adventure' });
  const adventure = await adventureById(adventureId);
  if (!adventure) return res.status(404).json({ error: 'adventure_not_found' });

  const name = clean(b.name, 120) || 'Untitled marker';
  const id = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO pois
       (id, adventure_id, name, slug, category, zone, blurb, description, fun_fact, image_url,
        x, y, scan_code, published, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      adventureId,
      name,
      await uniqueSlug(adventureId, name),
      clean(b.category, 40) || 'landmark',
      clean(b.zone, 80),
      clean(b.blurb, 300),
      clean(b.description, 4000),
      clean(b.fun_fact, 600),
      clean(b.image_url, 500),
      num(b.x, 1000),
      num(b.y, 700),
      await uniqueScanCode(),
      bool(b.published === undefined ? true : b.published),
      num(b.sort_order, 0),
      ts,
      ts,
    ]
  );
  res.status(201).json(await db.get('SELECT * FROM pois WHERE id = ?', [id]));
});

router.patch('/pois/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM pois WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};

  const name = b.name !== undefined ? clean(b.name, 120) || existing.name : existing.name;
  const slug =
    b.name !== undefined && name !== existing.name
      ? await uniqueSlug(existing.adventure_id, name, existing.id)
      : existing.slug;

  const pick = (key, fallback, max) =>
    b[key] !== undefined ? clean(b[key], max) : fallback;

  await db.run(
    `UPDATE pois SET name=?, slug=?, category=?, zone=?, blurb=?, description=?,
       fun_fact=?, image_url=?, x=?, y=?, published=?, sort_order=?, updated_at=?
     WHERE id=?`,
    [
      name,
      slug,
      pick('category', existing.category, 40) || 'landmark',
      pick('zone', existing.zone, 80),
      pick('blurb', existing.blurb, 300),
      pick('description', existing.description, 4000),
      pick('fun_fact', existing.fun_fact, 600),
      pick('image_url', existing.image_url, 500),
      b.x !== undefined ? num(b.x, existing.x) : existing.x,
      b.y !== undefined ? num(b.y, existing.y) : existing.y,
      b.published !== undefined ? bool(b.published) : existing.published,
      b.sort_order !== undefined ? num(b.sort_order, existing.sort_order) : existing.sort_order,
      now(),
      existing.id,
    ]
  );
  res.json(await db.get('SELECT * FROM pois WHERE id = ?', [existing.id]));
});

router.patch('/pois/:id/position', async (req, res) => {
  const updated = await db.run('UPDATE pois SET x = ?, y = ?, updated_at = ? WHERE id = ?', [
    num(req.body?.x, 0),
    num(req.body?.y, 0),
    now(),
    req.params.id,
  ]);
  if (!updated.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

router.post('/pois/:id/rotate-code', async (req, res) => {
  const code = await uniqueScanCode();
  const updated = await db.run('UPDATE pois SET scan_code = ?, updated_at = ? WHERE id = ?', [
    code,
    now(),
    req.params.id,
  ]);
  if (!updated.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ scan_code: code });
});

router.delete('/pois/:id', async (req, res) => {
  await db.run('DELETE FROM pois WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/* ---------------------------------- hunts -------------------------------- */

router.post('/hunts', async (req, res) => {
  const b = req.body || {};
  const adventureId = clean(b.adventure_id, 80);
  if (!adventureId) return res.status(400).json({ error: 'missing_adventure' });
  const title = clean(b.title, 120) || 'Untitled hunt';
  const id = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO hunts (id, adventure_id, title, slug, tagline, description, reward_title, reward_body,
       reward_code, active, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      adventureId,
      title,
      slugify(title, 'hunt'),
      clean(b.tagline, 200),
      clean(b.description, 2000),
      clean(b.reward_title, 120) || 'Reward unlocked',
      clean(b.reward_body, 1000),
      clean(b.reward_code, 40) || shortCode(5),
      bool(b.active === undefined ? true : b.active),
      num(b.sort_order, 0),
      ts,
      ts,
    ]
  );
  res.status(201).json(await db.get('SELECT * FROM hunts WHERE id = ?', [id]));
});

router.patch('/hunts/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM hunts WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const pick = (key, fallback, max) => (b[key] !== undefined ? clean(b[key], max) : fallback);
  await db.run(
    `UPDATE hunts SET title=?, tagline=?, description=?, reward_title=?, reward_body=?,
       reward_code=?, active=?, sort_order=?, updated_at=? WHERE id=?`,
    [
      pick('title', existing.title, 120) || existing.title,
      pick('tagline', existing.tagline, 200),
      pick('description', existing.description, 2000),
      pick('reward_title', existing.reward_title, 120),
      pick('reward_body', existing.reward_body, 1000),
      pick('reward_code', existing.reward_code, 40),
      b.active !== undefined ? bool(b.active) : existing.active,
      b.sort_order !== undefined ? num(b.sort_order, existing.sort_order) : existing.sort_order,
      now(),
      existing.id,
    ]
  );
  res.json(await db.get('SELECT * FROM hunts WHERE id = ?', [existing.id]));
});

router.delete('/hunts/:id', async (req, res) => {
  await db.run('DELETE FROM hunt_stops WHERE hunt_id = ?', [req.params.id]);
  await db.run('DELETE FROM hunts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/hunts/:id/stops', async (req, res) => {
  const hunt = await db.get('SELECT id, adventure_id FROM hunts WHERE id = ?', [req.params.id]);
  if (!hunt) return res.status(404).json({ error: 'hunt_not_found' });
  const poi = await db.get('SELECT id, name, adventure_id FROM pois WHERE id = ?', [req.body?.poi_id]);
  if (!poi) return res.status(400).json({ error: 'poi_not_found' });
  if (poi.adventure_id !== hunt.adventure_id) {
    return res.status(400).json({ error: 'poi_wrong_adventure' });
  }

  const dupe = await db.get('SELECT id FROM hunt_stops WHERE hunt_id = ? AND poi_id = ?', [
    hunt.id,
    poi.id,
  ]);
  if (dupe) return res.status(409).json({ error: 'already_a_stop' });

  const last = await db.get(
    'SELECT MAX(position) AS p FROM hunt_stops WHERE hunt_id = ?',
    [hunt.id]
  );
  const id = uuid();
  const challengeType = normalizeChallengeType(req.body?.challenge_type);
  await db.run(
    `INSERT INTO hunt_stops
       (id, hunt_id, poi_id, token_name, token_glyph, hint, position, challenge_type, challenge_config)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      id,
      hunt.id,
      poi.id,
      clean(req.body?.token_name, 80) || `${poi.name} token`,
      clean(req.body?.token_glyph, 30) || 'crystal',
      clean(req.body?.hint, 400),
      num(last?.p, -1) + 1,
      challengeType,
      serializeConfig(req.body?.challenge_config),
    ]
  );
  res.status(201).json(await db.get('SELECT * FROM hunt_stops WHERE id = ?', [id]));
});

router.patch('/stops/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM hunt_stops WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const challengeType =
    b.challenge_type !== undefined
      ? normalizeChallengeType(b.challenge_type)
      : existing.challenge_type || 'scan';
  const challengeConfig =
    b.challenge_config !== undefined
      ? serializeConfig(b.challenge_config)
      : existing.challenge_config;

  await db.run(
    `UPDATE hunt_stops SET token_name=?, token_glyph=?, hint=?, position=?,
       challenge_type=?, challenge_config=? WHERE id=?`,
    [
      b.token_name !== undefined ? clean(b.token_name, 80) || existing.token_name : existing.token_name,
      b.token_glyph !== undefined ? clean(b.token_glyph, 30) || 'crystal' : existing.token_glyph,
      b.hint !== undefined ? clean(b.hint, 400) : existing.hint,
      b.position !== undefined ? num(b.position, existing.position) : existing.position,
      challengeType,
      challengeConfig,
      existing.id,
    ]
  );
  res.json(await db.get('SELECT * FROM hunt_stops WHERE id = ?', [existing.id]));
});

router.delete('/stops/:id', async (req, res) => {
  await db.run('DELETE FROM hunt_stops WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/challenge-types', (_req, res) => {
  res.json({ types: CHALLENGE_TYPES });
});

/* ------------------------------ journey touchpoints ---------------------- */

const TOUCH_TYPES = ['threshold', 'guardian', 'monument', 'heart'];

async function uniqueTouchSlug(adventureId, raw, ignoreId = null) {
  const explicit = String(raw || '').trim();
  let candidate = explicit
    ? slugify(explicit, 'stop')
    : shortCode(8).toLowerCase();
  const base = candidate;
  for (let i = 2; i < 200; i++) {
    const clash = await db.get(
      'SELECT id FROM touchpoints WHERE adventure_id = ? AND slug = ?',
      [adventureId, candidate]
    );
    if (!clash || clash.id === ignoreId) return candidate;
    candidate = explicit ? `${base}-${i}` : shortCode(8).toLowerCase();
  }
  return `${base}-${shortCode(4).toLowerCase()}`;
}

router.post('/touchpoints', async (req, res) => {
  const b = req.body || {};
  const adventureId = clean(b.adventure_id, 80);
  if (!adventureId) return res.status(400).json({ error: 'missing_adventure' });
  const type = TOUCH_TYPES.includes(b.type) ? b.type : 'guardian';
  const title = clean(b.title, 120) || 'Untitled stop';
  const id = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO touchpoints
       (id, adventure_id, type, slug, title, subtitle, body, discover_body, element, image_url, audio_url,
        poi_id, sort_order, published, challenge_type, config, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      adventureId,
      type,
      await uniqueTouchSlug(adventureId, b.slug || null),
      title,
      clean(b.subtitle, 200),
      clean(b.body, 8000),
      clean(b.discover_body, 8000),
      clean(b.element, 40),
      clean(b.image_url, 500),
      clean(b.audio_url, 500),
      clean(b.poi_id, 80),
      num(b.sort_order, 0),
      bool(b.published === undefined ? true : b.published),
      clean(b.challenge_type, 40),
      b.config ? (typeof b.config === 'string' ? b.config : JSON.stringify(b.config)) : null,
      ts,
      ts,
    ]
  );
  res.status(201).json(await db.get('SELECT * FROM touchpoints WHERE id = ?', [id]));
});

router.patch('/touchpoints/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM touchpoints WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  const title = b.title !== undefined ? clean(b.title, 120) || existing.title : existing.title;
  const type = b.type !== undefined && TOUCH_TYPES.includes(b.type) ? b.type : existing.type;
  await db.run(
    `UPDATE touchpoints SET type=?, slug=?, title=?, subtitle=?, body=?, discover_body=?, element=?,
       image_url=?, audio_url=?, poi_id=?, sort_order=?, published=?, challenge_type=?, config=?, updated_at=?
     WHERE id=?`,
    [
      type,
      b.slug !== undefined
        ? await uniqueTouchSlug(existing.adventure_id, b.slug || null, existing.id)
        : existing.slug,
      title,
      b.subtitle !== undefined ? clean(b.subtitle, 200) : existing.subtitle,
      b.body !== undefined ? clean(b.body, 8000) : existing.body,
      b.discover_body !== undefined ? clean(b.discover_body, 8000) : existing.discover_body,
      b.element !== undefined ? clean(b.element, 40) : existing.element,
      b.image_url !== undefined ? clean(b.image_url, 500) : existing.image_url,
      b.audio_url !== undefined ? clean(b.audio_url, 500) : existing.audio_url,
      b.poi_id !== undefined ? clean(b.poi_id, 80) : existing.poi_id,
      b.sort_order !== undefined ? num(b.sort_order, existing.sort_order) : existing.sort_order,
      b.published !== undefined ? bool(b.published) : existing.published,
      b.challenge_type !== undefined ? clean(b.challenge_type, 40) : existing.challenge_type,
      b.config !== undefined
        ? b.config
          ? typeof b.config === 'string'
            ? b.config
            : JSON.stringify(b.config)
          : null
        : existing.config,
      now(),
      existing.id,
    ]
  );
  res.json(await db.get('SELECT * FROM touchpoints WHERE id = ?', [existing.id]));
});

router.delete('/touchpoints/:id', async (req, res) => {
  await db.run('DELETE FROM touchpoints WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/* --------------------------------- QR codes ------------------------------ */

function originOf(req) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return base.replace(/\/$/, '');
}

function scanUrl(req, code, locationSlug) {
  const root = originOf(req);
  if (locationSlug) return `${root}/${locationSlug}/s/${code}`;
  return `${root}/s/${code}`;
}

function stationUrl(req, venueCode, slug) {
  return `${originOf(req)}/${venueCode || 'nh'}/${slug}`;
}

async function qrPng(text) {
  return QRCode.toBuffer(text, {
    type: 'png',
    margin: 1,
    errorCorrectionLevel: 'M',
    width: 1024,
  });
}

router.get('/qr/:id.svg', async (req, res) => {
  const poi = await db.get(
    `SELECT p.*, l.slug AS location_slug
       FROM pois p
       LEFT JOIN adventures a ON a.id = p.adventure_id
       LEFT JOIN locations l ON l.id = a.location_id
      WHERE p.id = ?`,
    [req.params.id]
  );
  if (!poi || !poi.scan_code) return res.status(404).send('Not found');
  const svg = await QRCode.toString(scanUrl(req, poi.scan_code, poi.location_slug), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  res.type('image/svg+xml').send(svg);
});

router.get('/qr/:id.png', async (req, res) => {
  const poi = await db.get(
    `SELECT p.*, l.slug AS location_slug
       FROM pois p
       LEFT JOIN adventures a ON a.id = p.adventure_id
       LEFT JOIN locations l ON l.id = a.location_id
      WHERE p.id = ?`,
    [req.params.id]
  );
  if (!poi || !poi.scan_code) return res.status(404).send('Not found');
  const png = await qrPng(scanUrl(req, poi.scan_code, poi.location_slug));
  res.type('image/png').send(png);
});

router.get('/qr-sheet', async (req, res) => {
  const adventureId = clean(req.query.adventure_id, 80);
  const params = [];
  let sql =
    `SELECT p.*, l.slug AS location_slug
       FROM pois p
       LEFT JOIN adventures a ON a.id = p.adventure_id
       LEFT JOIN locations l ON l.id = a.location_id
      WHERE p.published = 1 AND p.scan_code IS NOT NULL`;
  if (adventureId) {
    sql += ' AND p.adventure_id = ?';
    params.push(adventureId);
  }
  sql += ' ORDER BY p.sort_order, p.name';
  const pois = await db.all(sql, params);

  const cards = await Promise.all(
    pois.map(async (p) => {
      const svg = await QRCode.toString(scanUrl(req, p.scan_code, p.location_slug), {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      });
      const zone = p.zone ? `<div class="zone">${escapeHtml(p.zone)}</div>` : '';
      return `<section class="card">
        ${zone}
        <h1>${escapeHtml(p.name)}</h1>
        <div class="qr">${svg}</div>
        <p class="hint">Scan with your phone camera</p>
        <p class="code">${escapeHtml(p.scan_code)}</p>
      </section>`;
    })
  );
  res.type('html').send(`<!doctype html><meta charset="utf-8">
<title>Scan signs</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #fff; color: #000; }
  .card { page-break-after: always; height: 10in; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; gap: 0.25in; }
  .zone { letter-spacing: .28em; text-transform: uppercase; font-size: 13pt; color: #444; }
  h1 { font-size: 34pt; margin: 0; max-width: 6.5in; line-height: 1.05; }
  .qr { width: 4.6in; height: 4.6in; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .hint { font-size: 15pt; margin: 0; color: #333; }
  .code { font-family: ui-monospace, monospace; font-size: 20pt; letter-spacing: .18em; margin: 0; }
  @media screen { body { padding: 24px; background: #eef2f6; } .card { background:#fff; margin: 0 auto 24px; width: 8.5in; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
</style>
${cards.join('\n') || '<p style="padding:2rem">No published markers with scan codes yet.</p>'}`);
});

router.get('/station-qr/:id.svg', async (req, res) => {
  const row = await db.get(
    `SELECT t.*, l.venue_code
       FROM touchpoints t
       JOIN adventures a ON a.id = t.adventure_id
       JOIN locations l ON l.id = a.location_id
      WHERE t.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).send('Not found');
  const svg = await QRCode.toString(stationUrl(req, row.venue_code, row.slug), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  res.type('image/svg+xml').send(svg);
});

router.get('/station-qr/:id.png', async (req, res) => {
  const row = await db.get(
    `SELECT t.*, l.venue_code
       FROM touchpoints t
       JOIN adventures a ON a.id = t.adventure_id
       JOIN locations l ON l.id = a.location_id
      WHERE t.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).send('Not found');
  const png = await qrPng(stationUrl(req, row.venue_code, row.slug));
  res.type('image/png').send(png);
});

router.get('/station-sheet', async (req, res) => {
  const adventureId = clean(req.query.adventure_id, 80);
  if (!adventureId) return res.status(400).send('missing adventure');
  const rows = await db.all(
    `SELECT t.*, l.venue_code
       FROM touchpoints t
       JOIN adventures a ON a.id = t.adventure_id
       JOIN locations l ON l.id = a.location_id
      WHERE t.adventure_id = ? AND t.published = 1
      ORDER BY t.sort_order, t.title`,
    [adventureId]
  );
  const cards = await Promise.all(
    rows.map(async (t) => {
      const url = stationUrl(req, t.venue_code, t.slug);
      const svg = await QRCode.toString(url, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      });
      return `<section class="card">
        <div class="zone">${escapeHtml(t.type)}</div>
        <h1>${escapeHtml(t.title)}</h1>
        <div class="qr">${svg}</div>
        <p class="hint">Scan with your phone camera</p>
        <p class="code">/${escapeHtml(t.venue_code || 'nh')}/${escapeHtml(t.slug)}</p>
      </section>`;
    })
  );
  res.type('html').send(`<!doctype html><meta charset="utf-8">
<title>Castle Quest signs</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #fff; color: #000; }
  .card { page-break-after: always; height: 10in; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; gap: 0.25in; }
  .zone { letter-spacing: .28em; text-transform: uppercase; font-size: 13pt; color: #444; }
  h1 { font-size: 34pt; margin: 0; max-width: 6.5in; line-height: 1.05; }
  .qr { width: 4.6in; height: 4.6in; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .hint { font-size: 15pt; margin: 0; color: #333; }
  .code { font-family: ui-monospace, monospace; font-size: 16pt; letter-spacing: .08em; margin: 0; }
  @media screen { body { padding: 24px; background: #eef2f6; } .card { background:#fff; margin: 0 auto 24px; width: 8.5in; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
</style>
${cards.join('\n') || '<p style="padding:2rem">No published quest stations yet.</p>'}`);
});

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

module.exports = { router, requireAdmin };
