const express = require('express');
const db = require('../db');
const { uuid, now, clean } = require('../helpers');
const {
  resolveAdventure,
  publicAdventure,
  parkFromAdventure,
  mapFromAdventure,
  awardStop,
  normalizeChallengeType,
  validateChallengeAnswer,
  publicChallengeConfig,
} = require('../adventures');

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Anonymous guests
 * ------------------------------------------------------------------ */

async function touchGuest(token) {
  if (!token) return null;
  const guest = await db.get('SELECT * FROM guests WHERE id = ?', [token]);
  if (!guest) return null;
  await db.run('UPDATE guests SET last_seen_at = ? WHERE id = ?', [now(), token]);
  return guest;
}

async function createGuest() {
  const id = uuid();
  const ts = now();
  await db.run(
    'INSERT INTO guests (id, nickname, created_at, last_seen_at, visits) VALUES (?, ?, ?, ?, 1)',
    [id, null, ts, ts]
  );
  return db.get('SELECT * FROM guests WHERE id = ?', [id]);
}

/** Progress scoped to one adventure's POIs and hunts. */
async function progressFor(guestId, adventureId) {
  if (!guestId || !adventureId) return { scans: [], tokens: [], completions: [] };
  const [scans, tokens, completions] = await Promise.all([
    db.all(
      `SELECT s.poi_id, s.scanned_at FROM guest_scans s
         JOIN pois p ON p.id = s.poi_id
        WHERE s.guest_id = ? AND p.adventure_id = ?`,
      [guestId, adventureId]
    ),
    db.all(
      `SELECT t.hunt_id, t.hunt_stop_id, t.earned_at FROM guest_tokens t
         JOIN hunts h ON h.id = t.hunt_id
        WHERE t.guest_id = ? AND h.adventure_id = ?`,
      [guestId, adventureId]
    ),
    db.all(
      `SELECT c.hunt_id, c.completed_at, c.redeem_code FROM hunt_completions c
         JOIN hunts h ON h.id = c.hunt_id
        WHERE c.guest_id = ? AND h.adventure_id = ?`,
      [guestId, adventureId]
    ),
  ]);
  return {
    scans: scans.map((s) => ({ poiId: s.poi_id, at: s.scanned_at })),
    tokens: tokens.map((t) => ({ huntId: t.hunt_id, stopId: t.hunt_stop_id, at: t.earned_at })),
    completions: completions.map((c) => ({
      huntId: c.hunt_id,
      at: c.completed_at,
      redeemCode: c.redeem_code,
    })),
  };
}

function publicPoi(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    zone: row.zone,
    blurb: row.blurb,
    description: row.description,
    funFact: row.fun_fact,
    imageUrl: row.image_url,
    x: row.x,
    y: row.y,
  };
}

function publicStop(s) {
  const type = normalizeChallengeType(s.challenge_type);
  return {
    id: s.id,
    poiId: s.poi_id,
    poiName: s.poi_name,
    zone: s.poi_zone,
    tokenName: s.token_name,
    tokenGlyph: s.token_glyph,
    hint: s.hint,
    x: s.x,
    y: s.y,
    challengeType: type,
    challenge: type === 'scan' ? null : publicChallengeConfig(type, s.challenge_config),
  };
}

function publicTouchpoint(row) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    element: row.element,
    imageUrl: row.image_url,
    audioUrl: row.audio_url,
    poiId: row.poi_id,
    sortOrder: row.sort_order,
  };
}

async function loadTouchpoints(adventureId) {
  const rows = await db.all(
    `SELECT * FROM touchpoints
      WHERE adventure_id = ? AND published = 1
      ORDER BY sort_order, created_at`,
    [adventureId]
  );
  return rows.map(publicTouchpoint);
}

async function loadHunts(adventureId) {
  const hunts = await db.all(
    'SELECT * FROM hunts WHERE adventure_id = ? AND active = 1 ORDER BY sort_order, created_at',
    [adventureId]
  );
  if (!hunts.length) return [];
  const stops = await db.all(
    `SELECT s.*, p.name AS poi_name, p.slug AS poi_slug, p.zone AS poi_zone, p.x, p.y, p.published
       FROM hunt_stops s JOIN pois p ON p.id = s.poi_id
      WHERE s.hunt_id IN (${hunts.map(() => '?').join(',')})
      ORDER BY s.position`,
    hunts.map((h) => h.id)
  );
  return hunts.map((h) => ({
    id: h.id,
    title: h.title,
    slug: h.slug,
    tagline: h.tagline,
    description: h.description,
    rewardTitle: h.reward_title,
    rewardBody: h.reward_body,
    stops: stops
      .filter((s) => s.hunt_id === h.id && s.published === 1)
      .map(publicStop),
  }));
}

async function resolveFromQuery(req) {
  const locationSlug = clean(req.query.location || req.query.adventure, 80);
  const year = req.query.year ? Number(req.query.year) : null;
  return resolveAdventure({
    locationSlug: locationSlug || null,
    year: Number.isFinite(year) ? year : null,
  });
}

/** GET /api/bootstrap — boots the guest app for one adventure package. */
router.get('/bootstrap', async (req, res) => {
  const adventure = await resolveFromQuery(req);
  if (!adventure) return res.status(404).json({ error: 'adventure_not_found' });

  let guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) guest = await createGuest();

  const poiRows = await db.all(
    'SELECT * FROM pois WHERE adventure_id = ? AND published = 1 ORDER BY sort_order, name',
    [adventure.id]
  );

  res.json({
    adventure: publicAdventure(adventure),
    park: parkFromAdventure(adventure),
    map: mapFromAdventure(adventure),
    guest: { token: guest.id, nickname: guest.nickname },
    pois: poiRows.map(publicPoi),
    hunts: await loadHunts(adventure.id),
    touchpoints: await loadTouchpoints(adventure.id),
    progress: await progressFor(guest.id, adventure.id),
  });
});

/** GET /api/adventures/resolve — used by the shell to map a path to a package. */
router.get('/adventures/resolve', async (req, res) => {
  const adventure = await resolveFromQuery(req);
  if (!adventure) return res.status(404).json({ error: 'adventure_not_found' });
  res.json(publicAdventure(adventure));
});

router.post('/guest', async (_req, res) => {
  const guest = await createGuest();
  res.json({ token: guest.id, nickname: null });
});

router.patch('/guest', async (req, res) => {
  const guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) return res.status(404).json({ error: 'unknown_guest' });
  const nickname = clean(req.body?.nickname, 40);
  await db.run('UPDATE guests SET nickname = ? WHERE id = ?', [nickname, guest.id]);
  res.json({ token: guest.id, nickname });
});

/* ------------------------------------------------------------------ *
 * Scanning — awards scan-type hunt stops only
 * ------------------------------------------------------------------ */

router.post('/scan', async (req, res) => {
  const raw = String(req.body?.code || '').trim();
  if (!raw) return res.status(400).json({ error: 'missing_code' });

  const code = raw.replace(/^.*\/s\//i, '').replace(/[?#].*$/, '').toUpperCase();

  let guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) guest = await createGuest();

  const poi = await db.get(
    'SELECT * FROM pois WHERE scan_code = ? AND published = 1',
    [code]
  );
  if (!poi) return res.status(404).json({ error: 'unknown_code', code });

  const existing = await db.get(
    'SELECT id FROM guest_scans WHERE guest_id = ? AND poi_id = ?',
    [guest.id, poi.id]
  );

  const ts = now();
  if (!existing) {
    await db.run(
      'INSERT INTO guest_scans (id, guest_id, poi_id, scanned_at) VALUES (?, ?, ?, ?)',
      [uuid(), guest.id, poi.id, ts]
    );
  }

  const awards = [];
  const completed = [];

  if (!existing) {
    const stops = await db.all(
      `SELECT s.*, h.title AS hunt_title, h.reward_title, h.reward_body, h.reward_code, h.adventure_id
         FROM hunt_stops s JOIN hunts h ON h.id = s.hunt_id
        WHERE s.poi_id = ? AND h.active = 1 AND h.adventure_id = ?`,
      [poi.id, poi.adventure_id]
    );

    for (const stop of stops) {
      const type = normalizeChallengeType(stop.challenge_type);
      if (type !== 'scan') continue;
      const result = await awardStop(guest.id, stop, ts);
      if (!result.already) {
        awards.push(...result.awards);
        completed.push(...result.completed);
      }
    }
  }

  res.json({
    guestToken: guest.id,
    poi: publicPoi(poi),
    alreadyScanned: Boolean(existing),
    awards,
    completed,
    progress: await progressFor(guest.id, poi.adventure_id),
  });
});

/**
 * POST /api/challenge  { stopId, answer }
 * Completes non-scan activations (acknowledge, code entry, quiz, reflection).
 */
router.post('/challenge', async (req, res) => {
  const stopId = clean(req.body?.stopId, 80);
  if (!stopId) return res.status(400).json({ error: 'missing_stop' });

  let guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) guest = await createGuest();

  const stop = await db.get(
    `SELECT s.*, h.title AS hunt_title, h.reward_title, h.reward_body, h.reward_code,
            h.active, h.adventure_id, p.published, p.id AS poi_row_id
       FROM hunt_stops s
       JOIN hunts h ON h.id = s.hunt_id
       JOIN pois p ON p.id = s.poi_id
      WHERE s.id = ?`,
    [stopId]
  );
  if (!stop || !stop.active || stop.published !== 1) {
    return res.status(404).json({ error: 'stop_not_found' });
  }

  const type = normalizeChallengeType(stop.challenge_type);
  if (type === 'scan') {
    return res.status(400).json({ error: 'requires_scan' });
  }

  const check = validateChallengeAnswer(type, stop.challenge_config, req.body?.answer);
  if (!check.ok) return res.status(400).json({ error: check.error || 'invalid_answer' });

  const ts = now();
  const visit = await db.get(
    'SELECT id FROM guest_scans WHERE guest_id = ? AND poi_id = ?',
    [guest.id, stop.poi_id]
  );
  if (!visit) {
    await db.run(
      'INSERT INTO guest_scans (id, guest_id, poi_id, scanned_at) VALUES (?, ?, ?, ?)',
      [uuid(), guest.id, stop.poi_id, ts]
    );
  }

  const result = await awardStop(guest.id, stop, ts);
  const poi = await db.get('SELECT * FROM pois WHERE id = ?', [stop.poi_id]);

  res.json({
    guestToken: guest.id,
    poi: publicPoi(poi),
    alreadyCompleted: result.already,
    awards: result.awards,
    completed: result.completed,
    progress: await progressFor(guest.id, stop.adventure_id),
  });
});

router.get('/progress', async (req, res) => {
  const guest = await touchGuest(req.get('x-guest-token'));
  const adventure = await resolveFromQuery(req);
  if (!guest || !adventure) return res.json({ scans: [], tokens: [], completions: [] });
  res.json(await progressFor(guest.id, adventure.id));
});

module.exports = router;
