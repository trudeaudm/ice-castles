const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { uuid, shortCode, slugify, now, num, bool, clean } = require('../helpers');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'letmein';

/**
 * Single shared password, sent as a bearer token. Deliberately simple: this
 * dashboard is for one small ops team, not the public. Set ADMIN_PASSWORD in
 * Render's environment before anyone can reach it over the internet.
 */
function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  // Header for fetch() calls; query param for things opened in a new tab
  // (the printable sign sheet and QR downloads) where headers aren't possible.
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

/* ---------------------------- read everything ---------------------------- */

router.get('/state', async (_req, res) => {
  const settingRows = await db.all('SELECT "key", "value" FROM settings');
  const pois = await db.all('SELECT * FROM pois ORDER BY sort_order, name');
  const hunts = await db.all('SELECT * FROM hunts ORDER BY sort_order, created_at');
  const stops = await db.all('SELECT * FROM hunt_stops ORDER BY position');
  res.json({
    settings: Object.fromEntries(settingRows.map((r) => [r.key, r.value])),
    pois,
    hunts: hunts.map((h) => ({ ...h, stops: stops.filter((s) => s.hunt_id === h.id) })),
  });
});

router.get('/stats', async (_req, res) => {
  const [guests, scans, perPoi, perHunt] = await Promise.all([
    db.get('SELECT COUNT(*) AS n FROM guests'),
    db.get('SELECT COUNT(*) AS n FROM guest_scans'),
    db.all(
      `SELECT p.id, p.name, COUNT(s.id) AS scans
         FROM pois p LEFT JOIN guest_scans s ON s.poi_id = p.id
        GROUP BY p.id, p.name ORDER BY scans DESC, p.name`
    ),
    db.all(
      `SELECT h.id, h.title, COUNT(c.id) AS completions
         FROM hunts h LEFT JOIN hunt_completions c ON c.hunt_id = h.id
        GROUP BY h.id, h.title ORDER BY completions DESC, h.title`
    ),
  ]);
  res.json({
    guests: Number(guests.n),
    scans: Number(scans.n),
    perPoi: perPoi.map((r) => ({ ...r, scans: Number(r.scans) })),
    perHunt: perHunt.map((r) => ({ ...r, completions: Number(r.completions) })),
  });
});

/* -------------------------------- settings ------------------------------- */

router.put('/settings', async (req, res) => {
  const patch = req.body || {};
  for (const [key, value] of Object.entries(patch)) {
    if (!/^[a-z0-9_]{1,60}$/.test(key)) continue;
    const str = value === null || value === undefined ? '' : String(value).slice(0, 4000);
    const updated = await db.run('UPDATE settings SET "value" = ? WHERE "key" = ?', [str, key]);
    if (!updated.changes) {
      await db.run('INSERT INTO settings ("key", "value") VALUES (?, ?)', [key, str]);
    }
  }
  const rows = await db.all('SELECT "key", "value" FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

/* ------------------------------ points of interest ----------------------- */

async function uniqueSlug(name, ignoreId = null) {
  let base = slugify(name, 'poi');
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const clash = await db.get('SELECT id FROM pois WHERE slug = ?', [candidate]);
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
  const name = clean(b.name, 120) || 'Untitled marker';
  const id = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO pois
       (id, name, slug, category, zone, blurb, description, fun_fact, image_url,
        x, y, scan_code, published, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      name,
      await uniqueSlug(name),
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
      ? await uniqueSlug(name, existing.id)
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

/** Dedicated lightweight endpoint so map dragging doesn't ship the whole record. */
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

/** Rotate a scan code if a physical sign is compromised or reprinted. */
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
  const title = clean(b.title, 120) || 'Untitled hunt';
  const id = uuid();
  const ts = now();
  await db.run(
    `INSERT INTO hunts (id, title, slug, tagline, description, reward_title, reward_body,
       reward_code, active, sort_order, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
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
  const hunt = await db.get('SELECT id FROM hunts WHERE id = ?', [req.params.id]);
  if (!hunt) return res.status(404).json({ error: 'hunt_not_found' });
  const poi = await db.get('SELECT id, name FROM pois WHERE id = ?', [req.body?.poi_id]);
  if (!poi) return res.status(400).json({ error: 'poi_not_found' });

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
  await db.run(
    `INSERT INTO hunt_stops (id, hunt_id, poi_id, token_name, token_glyph, hint, position)
     VALUES (?,?,?,?,?,?,?)`,
    [
      id,
      hunt.id,
      poi.id,
      clean(req.body?.token_name, 80) || `${poi.name} token`,
      clean(req.body?.token_glyph, 30) || 'crystal',
      clean(req.body?.hint, 400),
      num(last?.p, -1) + 1,
    ]
  );
  res.status(201).json(await db.get('SELECT * FROM hunt_stops WHERE id = ?', [id]));
});

router.patch('/stops/:id', async (req, res) => {
  const existing = await db.get('SELECT * FROM hunt_stops WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  await db.run(
    'UPDATE hunt_stops SET token_name=?, token_glyph=?, hint=?, position=? WHERE id=?',
    [
      b.token_name !== undefined ? clean(b.token_name, 80) || existing.token_name : existing.token_name,
      b.token_glyph !== undefined ? clean(b.token_glyph, 30) || 'crystal' : existing.token_glyph,
      b.hint !== undefined ? clean(b.hint, 400) : existing.hint,
      b.position !== undefined ? num(b.position, existing.position) : existing.position,
      existing.id,
    ]
  );
  res.json(await db.get('SELECT * FROM hunt_stops WHERE id = ?', [existing.id]));
});

router.delete('/stops/:id', async (req, res) => {
  await db.run('DELETE FROM hunt_stops WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/* --------------------------------- QR codes ------------------------------ */

function scanUrl(req, code) {
  const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/$/, '')}/s/${code}`;
}

/** SVG so signs print crisply at any size. */
router.get('/qr/:id.svg', async (req, res) => {
  const poi = await db.get('SELECT * FROM pois WHERE id = ?', [req.params.id]);
  if (!poi || !poi.scan_code) return res.status(404).send('Not found');
  const svg = await QRCode.toString(scanUrl(req, poi.scan_code), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  res.type('image/svg+xml').send(svg);
});

/**
 * GET /api/admin/qr-sheet?token=...  — printable signs, one per page.
 * Opened in a new tab, so the password rides along as a query param.
 */
router.get('/qr-sheet', async (req, res) => {
  const pois = await db.all(
    'SELECT * FROM pois WHERE published = 1 AND scan_code IS NOT NULL ORDER BY sort_order, name'
  );
  const cards = await Promise.all(
    pois.map(async (p) => {
      const svg = await QRCode.toString(scanUrl(req, p.scan_code), {
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

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

module.exports = { router, requireAdmin };
