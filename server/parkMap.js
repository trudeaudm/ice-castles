/**
 * One drawing per park (location). The drone photo is a tracing guide.
 * Publish writes a WebP and points every adventure at that park to it.
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { now, num } = require('./helpers');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const MAPS_DIR = path.join(DATA_DIR, 'maps');

const STAMPS = new Set(['fir1', 'fir2', 'fir3', 'hut', 'lamp', 'tower', 'wall']);
const PATH_STYLES = new Set(['snow', 'boardwalk', 'bridge']);
const REF_EXTS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function locationOk(id) {
  return /^[A-Za-z0-9-]{8,80}$/.test(String(id || ''));
}

function mapDir(locationId) {
  return path.join(MAPS_DIR, locationId);
}

function defaultDocument() {
  return { width: 2000, height: 1400, reference: null, features: [] };
}

function normalizeFeature(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  if (!id) return null;
  if (raw.type === 'stamp' && STAMPS.has(raw.kind)) {
    return {
      id,
      type: 'stamp',
      kind: raw.kind,
      x: num(raw.x),
      y: num(raw.y),
      rotation: num(raw.rotation),
      scale: clamp(num(raw.scale, 1), 0.2, 8),
    };
  }
  if (raw.type === 'path' && PATH_STYLES.has(raw.style) && Array.isArray(raw.points)) {
    const points = raw.points.slice(0, 500).map((p) => ({ x: num(p?.x), y: num(p?.y) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (points.length < 2) return null;
    return {
      id,
      type: 'path',
      style: raw.style,
      width: clamp(Math.round(num(raw.width, 32)), 4, 200),
      points,
    };
  }
  return null;
}

function normalizeDocument(input, locationId) {
  const src = input && typeof input === 'object' ? input : {};
  const width = clamp(Math.round(num(src.width, 2000)), 400, 8000);
  const height = clamp(Math.round(num(src.height, 1400)), 400, 8000);
  const features = Array.isArray(src.features)
    ? src.features.slice(0, 2000).map(normalizeFeature).filter(Boolean)
    : [];
  let reference = null;
  const ref = src.reference;
  const refUrl = `/api/admin/locations/${locationId}/map/reference`;
  if (ref && typeof ref === 'object' && ref.url === refUrl) {
    reference = {
      url: refUrl,
      x: num(ref.x),
      y: num(ref.y),
      w: clamp(num(ref.w, width), 10, 20000),
      h: clamp(num(ref.h, height), 10, 20000),
      rotation: num(ref.rotation),
      opacity: clamp(num(ref.opacity, 0.55), 0, 1),
      locked: Boolean(ref.locked),
    };
  }
  return { width, height, reference, features };
}

async function readRow(locationId) {
  return db.get('SELECT * FROM park_maps WHERE location_id = ?', [locationId]);
}

function parseRow(row, locationId) {
  if (!row) {
    return { location_id: locationId, document: defaultDocument(), published_url: null };
  }
  let document = defaultDocument();
  try {
    document = normalizeDocument(JSON.parse(row.document), locationId);
  } catch {
    document = defaultDocument();
  }
  return {
    location_id: locationId,
    document,
    published_url: row.published_url || null,
  };
}

async function getParkMap(locationId) {
  if (!locationOk(locationId)) return null;
  const loc = await db.get('SELECT id FROM locations WHERE id = ?', [locationId]);
  if (!loc) return null;
  return parseRow(await readRow(locationId), locationId);
}

async function writeRow(locationId, document, publishedUrl) {
  const ts = now();
  const existing = await readRow(locationId);
  const published = publishedUrl !== undefined ? publishedUrl : existing?.published_url || null;
  const payload = JSON.stringify(document);
  if (existing) {
    await db.run(
      `UPDATE park_maps SET document=?, published_url=?, width=?, height=?, updated_at=? WHERE location_id=?`,
      [payload, published, String(document.width), String(document.height), ts, locationId]
    );
  } else {
    await db.run(
      `INSERT INTO park_maps (location_id, document, published_url, width, height, updated_at)
       VALUES (?,?,?,?,?,?)`,
      [locationId, payload, published, String(document.width), String(document.height), ts]
    );
  }
  return { location_id: locationId, document, published_url: published };
}

async function saveParkMap(locationId, input) {
  const current = await getParkMap(locationId);
  if (!current) return null;
  const document = normalizeDocument(input, locationId);
  if (document.reference && !(await referenceFile(locationId))) {
    document.reference = null;
  }
  return writeRow(locationId, document);
}

function referenceFileSync(locationId) {
  const dir = mapDir(locationId);
  for (const ext of Object.values(REF_EXTS)) {
    const file = path.join(dir, `reference${ext}`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

async function referenceFile(locationId) {
  return referenceFileSync(locationId);
}

async function saveReference(locationId, buffer, mime) {
  const current = await getParkMap(locationId);
  if (!current) return null;
  const ext = REF_EXTS[mime];
  if (!ext || !Buffer.isBuffer(buffer) || buffer.length < 32) return null;
  const dir = mapDir(locationId);
  fs.mkdirSync(dir, { recursive: true });
  for (const other of Object.values(REF_EXTS)) {
    const file = path.join(dir, `reference${other}`);
    if (other !== ext && fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.writeFileSync(path.join(dir, `reference${ext}`), buffer);
  const prev = current.document.reference;
  const document = {
    ...current.document,
    reference: {
      url: `/api/admin/locations/${locationId}/map/reference`,
      x: prev?.x ?? 0,
      y: prev?.y ?? 0,
      w: prev?.w || current.document.width,
      h: prev?.h || current.document.height,
      rotation: prev?.rotation ?? 0,
      opacity: prev?.opacity ?? 0.55,
      locked: Boolean(prev?.locked),
    },
  };
  return writeRow(locationId, document);
}

async function readReference(locationId) {
  if (!locationOk(locationId)) return null;
  const loc = await db.get('SELECT id FROM locations WHERE id = ?', [locationId]);
  if (!loc) return null;
  const file = referenceFileSync(locationId);
  if (!file) return null;
  const ext = path.extname(file);
  const mime = Object.entries(REF_EXTS).find(([, value]) => value === ext)?.[0] || 'application/octet-stream';
  return { file, mime };
}

async function clearReference(locationId) {
  const current = await getParkMap(locationId);
  if (!current) return null;
  const dir = mapDir(locationId);
  for (const ext of Object.values(REF_EXTS)) {
    const file = path.join(dir, `reference${ext}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  return writeRow(locationId, { ...current.document, reference: null });
}

async function publishedFor(locationId) {
  const row = await db.get(
    'SELECT published_url, width, height FROM park_maps WHERE location_id = ?',
    [locationId]
  );
  if (!row?.published_url) return null;
  return row;
}

async function publishMap(locationId, buffer, mime) {
  const current = await getParkMap(locationId);
  if (!current) return null;
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) return null;
  const ext = mime === 'image/png' ? '.png' : '.webp';
  if (mime !== 'image/webp' && mime !== 'image/png') return null;
  const dir = mapDir(locationId);
  fs.mkdirSync(dir, { recursive: true });
  for (const other of ['.webp', '.png']) {
    if (other !== ext) {
      const stale = path.join(dir, `published${other}`);
      if (fs.existsSync(stale)) fs.unlinkSync(stale);
    }
  }
  fs.writeFileSync(path.join(dir, `published${ext}`), buffer);
  const publishedUrl = `/maps/${locationId}/published${ext}?v=${Date.now()}`;
  const saved = await writeRow(locationId, current.document, publishedUrl);
  const result = await db.run(
    `UPDATE adventures SET map_image_url=?, map_width=?, map_height=?, updated_at=? WHERE location_id=?`,
    [publishedUrl, String(saved.document.width), String(saved.document.height), now(), locationId]
  );
  return {
    published_url: publishedUrl,
    width: saved.document.width,
    height: saved.document.height,
    adventures: result.changes || 0,
  };
}

module.exports = {
  MAPS_DIR,
  getParkMap,
  saveParkMap,
  saveReference,
  readReference,
  clearReference,
  publishedFor,
  publishMap,
};
