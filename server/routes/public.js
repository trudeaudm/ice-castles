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
const quest = require('../quest');

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

function publicTouchpoint(row, venueCode, sessionPublic) {
  const type = row.challenge_type ? normalizeChallengeType(row.challenge_type) : null;
  const realmDone = Boolean(
    row.element && sessionPublic?.realms?.some((r) => r.realm === row.element && r.complete)
  );
  const stationDone =
    row.type === 'heart'
      ? Boolean(sessionPublic?.heartScannedAt && sessionPublic?.realmsComplete)
      : row.type === 'monument'
        ? Boolean(sessionPublic?.buildersVisitedAt)
        : realmDone;
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    discoverBody: row.discover_body,
    element: row.element,
    imageUrl: row.image_url,
    audioUrl: row.audio_url,
    poiId: row.poi_id,
    sortOrder: row.sort_order,
    path: `/${venueCode || 'nh'}/${row.slug}`,
    challengeType: type && type !== 'scan' ? type : row.challenge_type || null,
    challenge:
      row.challenge_type && row.challenge_type !== 'scan'
        ? publicChallengeConfig(normalizeChallengeType(row.challenge_type), row.config)
        : null,
    complete: stationDone,
  };
}

async function loadTouchpoints(adventureId, venueCode, sessionPublic) {
  const rows = await db.all(
    `SELECT * FROM touchpoints
      WHERE adventure_id = ? AND published = 1
      ORDER BY sort_order, created_at`,
    [adventureId]
  );
  return rows.map((row) => publicTouchpoint(row, venueCode, sessionPublic));
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
  const venueCode = clean(req.query.venue, 20);
  const locationSlug = clean(req.query.location || req.query.adventure, 80);
  const year = req.query.year ? Number(req.query.year) : null;
  return resolveAdventure({
    venueCode: venueCode || null,
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

  const pack = await quest.sessionWithRealms(guest.id, adventure.id);
  const pubAdv = publicAdventure(adventure);
  res.json({
    adventure: pubAdv,
    park: parkFromAdventure(adventure),
    map: mapFromAdventure(adventure),
    guest: { token: guest.id, nickname: guest.nickname },
    session: pack.public,
    operatingDate: quest.operatingDateKey(),
    pois: poiRows.map(publicPoi),
    hunts: await loadHunts(adventure.id),
    touchpoints: await loadTouchpoints(adventure.id, pubAdv.venueCode, pack.public),
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

/* ------------------------------------------------------------------ *
 * Castle Quest — same-day session, stations, Heart, completion
 * ------------------------------------------------------------------ */

async function guestAndAdventure(req, res) {
  const adventure = await resolveFromQuery(req);
  if (!adventure) {
    res.status(404).json({ error: 'adventure_not_found' });
    return null;
  }
  let guest = await touchGuest(req.get('x-guest-token'));
  if (!guest) guest = await createGuest();
  return { guest, adventure };
}

async function stationBySlug(adventureId, slug) {
  return db.get(
    'SELECT * FROM touchpoints WHERE adventure_id = ? AND slug = ? AND published = 1',
    [adventureId, slug]
  );
}

async function refreshPack(guestId, adventure) {
  const pack = await quest.sessionWithRealms(guestId, adventure.id);
  const pubAdv = publicAdventure(adventure);
  return {
    guestToken: guestId,
    session: pack.public,
    touchpoints: await loadTouchpoints(adventure.id, pubAdv.venueCode, pack.public),
  };
}

router.post('/quest/session', async (req, res) => {
  const ctx = await guestAndAdventure(req, res);
  if (!ctx) return;
  const starting = clean(req.body?.station, 80);
  const started = await quest.startSession(ctx.guest.id, ctx.adventure.id, starting, req);
  res.json({
    ...(await refreshPack(ctx.guest.id, ctx.adventure)),
    created: started.created,
  });
});

router.post('/quest/visit', async (req, res) => {
  const ctx = await guestAndAdventure(req, res);
  if (!ctx) return;
  const slug = clean(req.body?.station, 80);
  const station = slug ? await stationBySlug(ctx.adventure.id, slug) : null;
  if (!station) return res.status(404).json({ error: 'station_not_found' });

  const pack = await quest.requireLiveSession(ctx.guest.id, ctx.adventure.id);
  if (pack.error) return res.status(409).json({ error: pack.error });

  await quest.track(pack.row, 'station_scan', { station: slug, payload: { type: station.type } }, req);

  if (station.type === 'monument') {
    const updated = await quest.markBuildersVisited(pack.row);
    if (!pack.row.builders_visited_at) {
      await quest.track(updated, 'builders_visited', { station: slug }, req);
    }
  }

  res.json(await refreshPack(ctx.guest.id, ctx.adventure));
});

router.post('/quest/challenge', async (req, res) => {
  const ctx = await guestAndAdventure(req, res);
  if (!ctx) return;
  const slug = clean(req.body?.station, 80);
  const station = slug ? await stationBySlug(ctx.adventure.id, slug) : null;
  if (!station) return res.status(404).json({ error: 'station_not_found' });

  const pack = await quest.requireLiveSession(ctx.guest.id, ctx.adventure.id);
  if (pack.error) return res.status(409).json({ error: pack.error });

  const type = normalizeChallengeType(station.challenge_type);
  await quest.track(pack.row, 'challenge_attempt', {
    station: slug,
    payload: { type, realm: station.element },
  }, req);

  if (station.type === 'monument' || type === 'quiz') {
    const check = validateChallengeAnswer('quiz', station.config, req.body?.answer);
    if (!check.ok) return res.status(400).json({ error: check.error || 'invalid_answer' });
    const quiz = await quest.markBuilderQuiz(pack.row);
    if (!quiz.already) {
      await quest.track(quiz.row, 'builder_quiz_completed', { station: slug }, req);
      await quest.track(quiz.row, 'challenge_complete', { station: slug, payload: { type: 'quiz' } }, req);
    }
    return res.json({
      ...(await refreshPack(ctx.guest.id, ctx.adventure)),
      alreadyCompleted: quiz.already,
      realmAwakened: null,
    });
  }

  const check = validateChallengeAnswer(type, station.config, req.body?.answer);
  if (!check.ok) return res.status(400).json({ error: check.error || 'invalid_answer' });

  await quest.track(pack.row, 'challenge_complete', {
    station: slug,
    payload: { type, realm: station.element },
  }, req);

  let realmAwakened = null;
  if (station.type === 'guardian' && REALM_OK(station.element)) {
    const result = await quest.completeRealm(pack.row.id, station.element, station.id);
    if (!result.already) {
      await quest.track(pack.row, 'realm_complete', {
        station: slug,
        payload: { realm: station.element },
      }, req);
      realmAwakened = station.element;
    }
  }

  res.json({
    ...(await refreshPack(ctx.guest.id, ctx.adventure)),
    alreadyCompleted: !realmAwakened,
    realmAwakened,
  });
});

function REALM_OK(element) {
  return quest.REALMS.includes(element);
}

router.post('/quest/heart', async (req, res) => {
  const ctx = await guestAndAdventure(req, res);
  if (!ctx) return;
  const pack = await quest.requireLiveSession(ctx.guest.id, ctx.adventure.id);
  if (pack.error) return res.status(409).json({ error: pack.error });

  const remaining = quest.remainingRealms(pack.realms);
  const ready = remaining.length === 0;
  const updated = await quest.markHeartScan(pack.row);
  await quest.track(updated, 'heart_scan', {
    station: 'heart',
    payload: { complete: ready, remaining },
  }, req);

  res.json({
    ...(await refreshPack(ctx.guest.id, ctx.adventure)),
    eligible: ready,
    remaining,
  });
});

router.post('/quest/complete', async (req, res) => {
  const ctx = await guestAndAdventure(req, res);
  if (!ctx) return;
  const pack = await quest.requireLiveSession(ctx.guest.id, ctx.adventure.id);
  if (pack.error) return res.status(409).json({ error: pack.error });

  const remaining = quest.remainingRealms(pack.realms);
  if (remaining.length) {
    return res.status(409).json({ error: 'realms_incomplete', remaining });
  }
  if (!pack.row.heart_scanned_at) {
    return res.status(409).json({ error: 'heart_required' });
  }

  const firstTime = !pack.row.quest_complete_at;
  const finished = await quest.finishQuest(pack.row, {
    names: req.body?.names,
    partySize: req.body?.partySize,
    email: req.body?.email,
    marketingOptIn: req.body?.marketingOptIn,
  });

  if (firstTime) {
    await quest.track(finished, 'names_captured', {
      payload: { count: quest.parseJson(finished.keeper_names, []).length },
    }, req);
    if (finished.email) await quest.track(finished, 'email_supplied', {}, req);
    if (finished.marketing_opt_in) await quest.track(finished, 'marketing_opt_in', {}, req);
    await quest.track(finished, 'winter_keeper_complete', {
      payload: { partySize: finished.party_size },
    }, req);
  }

  res.json(await refreshPack(ctx.guest.id, ctx.adventure));
});

module.exports = router;
