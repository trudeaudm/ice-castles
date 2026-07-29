const express = require('express');
const db = require('../db');
const { uuid, now, clean } = require('../helpers');

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Anonymous guests
 *
 * There are no accounts. On first load the client asks for a guest
 * token, stores it in localStorage, and sends it as `x-guest-token`
 * from then on. Progress lives server-side against that token, so a
 * guest can close the browser, come back the next night, and still
 * have their tokens. Losing the token (cleared storage, new phone)
 * just starts a fresh visit — which is the right trade for not making
 * families create logins in the cold.
 * ------------------------------------------------------------------ */

async function loadSettings() {
  const rows = await db.all('SELECT "key", "value" FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

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

/** Everything the guest app needs to know about a guest's progress. */
async function progressFor(guestId) {
  if (!guestId) return { scans: [], tokens: [], completions: [] };
  const [scans, tokens, completions] = await Promise.all([
    db.all('SELECT poi_id, scanned_at FROM guest_scans WHERE guest_id = ?', [guestId]),
    db.all('SELECT hunt_id, hunt_stop_id, earned_at FROM guest_tokens WHERE guest_id = ?', [guestId]),
    db.all('SELECT hunt_id, completed_at, redeem_code FROM hunt_completions WHERE guest_id = ?', [guestId]),
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

async function loadHunts() {
  const hunts = await db.all(
    'SELECT * FROM hunts WHERE active = 1 ORDER BY sort_order, created_at'
  );
  if (!hunts.length) return [];
  const stops = await db.all(
    `SELECT s.*, p.name AS poi_name, p.slug AS poi_slug, p.zone AS poi_zone, p.x, p.y, p.published
       FROM hunt_stops s JOIN pois p ON p.id = s.poi_id
      ORDER BY s.position`
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
      .map((s) => ({
        id: s.id,
        poiId: s.poi_id,
        poiName: s.poi_name,
        zone: s.poi_zone,
        tokenName: s.token_name,
        tokenGlyph: s.token_glyph,
        hint: s.hint,
        x: s.x,
        y: s.y,
      })),
  }));
}

/** GET /api/bootstrap — single round trip that boots the whole app. */
router.get('/bootstrap', async (req, res) => {
  const settings = await loadSettings();
  let guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) guest = await createGuest();

  const poiRows = await db.all(
    'SELECT * FROM pois WHERE published = 1 ORDER BY sort_order, name'
  );

  res.json({
    park: {
      name: settings.park_name,
      locationName: settings.location_name,
      welcomeHeadline: settings.welcome_headline,
      welcomeBody: settings.welcome_body,
      hoursNote: settings.hours_note,
      safetyNote: settings.safety_note,
    },
    map: {
      imageUrl: settings.map_image_url,
      width: Number(settings.map_width) || 2000,
      height: Number(settings.map_height) || 1400,
    },
    guest: { token: guest.id, nickname: guest.nickname },
    pois: poiRows.map(publicPoi),
    hunts: await loadHunts(),
    progress: await progressFor(guest.id),
  });
});

/** POST /api/guest — mint a fresh anonymous guest (also used by "start over"). */
router.post('/guest', async (_req, res) => {
  const guest = await createGuest();
  res.json({ token: guest.id, nickname: null });
});

/** PATCH /api/guest — optional nickname, purely cosmetic. */
router.patch('/guest', async (req, res) => {
  const guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) return res.status(404).json({ error: 'unknown_guest' });
  const nickname = clean(req.body?.nickname, 40);
  await db.run('UPDATE guests SET nickname = ? WHERE id = ?', [nickname, guest.id]);
  res.json({ token: guest.id, nickname });
});

/* ------------------------------------------------------------------ *
 * Scanning — the core game verb
 * ------------------------------------------------------------------ */

/**
 * POST /api/scan  { code }
 *
 * Idempotent on purpose. Re-scanning a code a guest already has returns
 * the same POI with `alreadyScanned: true` and awards nothing, so a kid
 * mashing the same code doesn't farm tokens, and a flaky connection that
 * retries doesn't double-count.
 */
router.post('/scan', async (req, res) => {
  const raw = String(req.body?.code || '').trim();
  if (!raw) return res.status(400).json({ error: 'missing_code' });

  // Accept a bare code, or a full URL from a phone's native camera app.
  const code = raw.replace(/^.*\/s\//, '').replace(/[?#].*$/, '').toUpperCase();

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
    // Any active hunt that includes this POI hands over its token.
    const stops = await db.all(
      `SELECT s.*, h.title AS hunt_title, h.reward_title, h.reward_body, h.reward_code
         FROM hunt_stops s JOIN hunts h ON h.id = s.hunt_id
        WHERE s.poi_id = ? AND h.active = 1`,
      [poi.id]
    );

    for (const stop of stops) {
      await db.run(
        'INSERT INTO guest_tokens (id, guest_id, hunt_id, hunt_stop_id, earned_at) VALUES (?, ?, ?, ?, ?)',
        [uuid(), guest.id, stop.hunt_id, stop.id, ts]
      );

      const total = await db.get(
        `SELECT COUNT(*) AS n FROM hunt_stops s JOIN pois p ON p.id = s.poi_id
          WHERE s.hunt_id = ? AND p.published = 1`,
        [stop.hunt_id]
      );
      const earned = await db.get(
        'SELECT COUNT(*) AS n FROM guest_tokens WHERE guest_id = ? AND hunt_id = ?',
        [guest.id, stop.hunt_id]
      );

      const earnedCount = Number(earned.n);
      const totalCount = Number(total.n);

      awards.push({
        huntId: stop.hunt_id,
        huntTitle: stop.hunt_title,
        stopId: stop.id,
        tokenName: stop.token_name,
        tokenGlyph: stop.token_glyph,
        earnedCount,
        totalCount,
      });

      if (totalCount > 0 && earnedCount >= totalCount) {
        const already = await db.get(
          'SELECT id, redeem_code FROM hunt_completions WHERE guest_id = ? AND hunt_id = ?',
          [guest.id, stop.hunt_id]
        );
        const redeemCode = already?.redeem_code || stop.reward_code || null;
        if (!already) {
          await db.run(
            'INSERT INTO hunt_completions (id, guest_id, hunt_id, completed_at, redeem_code) VALUES (?, ?, ?, ?, ?)',
            [uuid(), guest.id, stop.hunt_id, ts, redeemCode]
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
    }
  }

  res.json({
    guestToken: guest.id,
    poi: publicPoi(poi),
    alreadyScanned: Boolean(existing),
    awards,
    completed,
    progress: await progressFor(guest.id),
  });
});

/** GET /api/progress — used when the app resumes after being backgrounded. */
router.get('/progress', async (req, res) => {
  const guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) return res.json({ scans: [], tokens: [], completions: [] });
  res.json(await progressFor(guest.id));
});

module.exports = router;
