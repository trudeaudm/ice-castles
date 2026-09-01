const db = require('./db');
const { uuid, now, clean, num, bool } = require('./helpers');

const REALMS = ['water', 'earth', 'fire', 'air', 'spirit'];
const OPERATING_TZ = 'America/New_York';
const CUTOFF_HOUR = 4;

const EVENT_TYPES = [
  'quest_started',
  'station_scan',
  'challenge_attempt',
  'challenge_complete',
  'realm_complete',
  'builders_visited',
  'builder_quiz_completed',
  'heart_scan',
  'names_captured',
  'email_supplied',
  'marketing_opt_in',
  'winter_keeper_complete',
];

function zonedParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

function addCalendarDays(year, month, day, delta) {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function operatingDateKey(date = new Date()) {
  const p = zonedParts(date);
  const day = p.hour < CUTOFF_HOUR ? addCalendarDays(p.year, p.month, p.day, -1) : p;
  return `${day.year}-${pad(day.month)}-${pad(day.day)}`;
}

function isSessionLive(session, date = new Date()) {
  return Boolean(session && session.operating_date === operatingDateKey(date));
}

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function track(session, type, extra = {}, req = null) {
  if (!EVENT_TYPES.includes(type)) return;
  await db.run(
    `INSERT INTO quest_events
       (id, session_id, guest_id, adventure_id, type, station_slug, payload, user_agent, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      uuid(),
      session?.id || null,
      session?.guest_id || extra.guestId || null,
      session?.adventure_id || extra.adventureId || null,
      type,
      extra.station || null,
      JSON.stringify(extra.payload || {}),
      clean(req?.get?.('user-agent'), 400),
      now(),
    ]
  );
}

async function realmsFor(sessionId) {
  if (!sessionId) return [];
  return db.all(
    'SELECT realm, station_id, completed_at FROM session_realms WHERE session_id = ?',
    [sessionId]
  );
}

function publicSession(row, realms = []) {
  if (!row) return null;
  const done = new Set(realms.map((r) => r.realm));
  return {
    id: row.id,
    operatingDate: row.operating_date,
    live: isSessionLive(row),
    startingStation: row.starting_station,
    partySize: row.party_size == null ? null : Number(row.party_size),
    keeperNames: parseJson(row.keeper_names, []),
    email: row.email || null,
    marketingOptIn: Boolean(row.marketing_opt_in),
    heartScannedAt: row.heart_scanned_at,
    questCompleteAt: row.quest_complete_at,
    buildersVisitedAt: row.builders_visited_at,
    builderQuizAt: row.builder_quiz_at,
    createdAt: row.created_at,
    realms: REALMS.map((realm) => ({
      realm,
      complete: done.has(realm),
      at: realms.find((r) => r.realm === realm)?.completed_at || null,
    })),
    realmsComplete: REALMS.every((realm) => done.has(realm)),
    winterKeeper: Boolean(row.quest_complete_at),
  };
}

async function loadSession(guestId, adventureId) {
  if (!guestId || !adventureId) return null;
  const row = await db.get(
    `SELECT * FROM quest_sessions
      WHERE guest_id = ? AND adventure_id = ? AND operating_date = ?
      ORDER BY created_at DESC LIMIT 1`,
    [guestId, adventureId, operatingDateKey()]
  );
  return row || null;
}

async function sessionWithRealms(guestId, adventureId) {
  const row = await loadSession(guestId, adventureId);
  if (!row) return { row: null, realms: [], public: null };
  const realms = await realmsFor(row.id);
  return { row, realms, public: publicSession(row, realms) };
}

async function startSession(guestId, adventureId, startingStation, req) {
  const existing = await loadSession(guestId, adventureId);
  if (existing) {
    const realms = await realmsFor(existing.id);
    return { row: existing, realms, public: publicSession(existing, realms), created: false };
  }

  const ts = now();
  const id = uuid();
  await db.run(
    `INSERT INTO quest_sessions
       (id, guest_id, adventure_id, starting_station, operating_date,
        party_size, keeper_names, email, marketing_opt_in,
        heart_scanned_at, quest_complete_at, builders_visited_at, builder_quiz_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, guestId, adventureId, clean(startingStation, 80), operatingDateKey(),
      null, null, null, 0,
      null, null, null, null, ts,
    ]
  );
  const row = await db.get('SELECT * FROM quest_sessions WHERE id = ?', [id]);
  await track(row, 'quest_started', {
    station: startingStation,
    payload: { startingStation, operatingDate: row.operating_date },
  }, req);
  return { row, realms: [], public: publicSession(row, []), created: true };
}

async function requireLiveSession(guestId, adventureId) {
  const pack = await sessionWithRealms(guestId, adventureId);
  if (!pack.row) return { error: 'no_session', ...pack };
  if (!isSessionLive(pack.row)) return { error: 'session_expired', ...pack };
  return pack;
}

async function completeRealm(sessionId, realm, stationId) {
  const existing = await db.get(
    'SELECT id FROM session_realms WHERE session_id = ? AND realm = ?',
    [sessionId, realm]
  );
  if (existing) return { already: true };
  await db.run(
    'INSERT INTO session_realms (id, session_id, realm, station_id, completed_at) VALUES (?,?,?,?,?)',
    [uuid(), sessionId, realm, stationId, now()]
  );
  return { already: false };
}

async function markBuildersVisited(session) {
  if (session.builders_visited_at) return session;
  await db.run(
    'UPDATE quest_sessions SET builders_visited_at = ? WHERE id = ?',
    [now(), session.id]
  );
  return db.get('SELECT * FROM quest_sessions WHERE id = ?', [session.id]);
}

async function markBuilderQuiz(session) {
  if (session.builder_quiz_at) return { row: session, already: true };
  await db.run(
    'UPDATE quest_sessions SET builder_quiz_at = ? WHERE id = ?',
    [now(), session.id]
  );
  return {
    row: await db.get('SELECT * FROM quest_sessions WHERE id = ?', [session.id]),
    already: false,
  };
}

async function markHeartScan(session) {
  const ts = session.heart_scanned_at || now();
  if (!session.heart_scanned_at) {
    await db.run('UPDATE quest_sessions SET heart_scanned_at = ? WHERE id = ?', [ts, session.id]);
  }
  return db.get('SELECT * FROM quest_sessions WHERE id = ?', [session.id]);
}

/** Later: POST opted-in addresses to Keep. Do not call until credentials exist. */
async function sendToKeep(_session) {
  return null;
}

async function finishQuest(session, { names, partySize, email, marketingOptIn }) {
  const keeperNames = (Array.isArray(names) ? names : [])
    .map((n) => clean(n, 40))
    .filter(Boolean)
    .slice(0, 20);
  const size = Math.max(1, Math.min(20, num(partySize, keeperNames.length || 1)));
  const mail = clean(email, 200);
  const optIn = bool(marketingOptIn);
  const ts = now();
  await db.run(
    `UPDATE quest_sessions SET
       party_size=?, keeper_names=?, email=?, marketing_opt_in=?, quest_complete_at=?
     WHERE id=?`,
    [size, JSON.stringify(keeperNames), mail, optIn, session.quest_complete_at || ts, session.id]
  );
  const row = await db.get('SELECT * FROM quest_sessions WHERE id = ?', [session.id]);
  if (row.marketing_opt_in && row.email) await sendToKeep(row);
  return row;
}

function remainingRealms(realms) {
  const done = new Set((realms || []).map((r) => r.realm));
  return REALMS.filter((realm) => !done.has(realm));
}

module.exports = {
  REALMS,
  OPERATING_TZ,
  operatingDateKey,
  isSessionLive,
  parseJson,
  track,
  publicSession,
  loadSession,
  sessionWithRealms,
  startSession,
  requireLiveSession,
  completeRealm,
  markBuildersVisited,
  markBuilderQuiz,
  markHeartScan,
  finishQuest,
  sendToKeep,
  remainingRealms,
  realmsFor,
};
