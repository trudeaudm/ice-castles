/**
 * The park drawing lives in the database, and the tracing photo lives on disk.
 * Render's database is not this computer's database, and its disk starts empty,
 * so the New Hampshire drawing ships with the site and is copied in on boot.
 *
 * An empty park receives the drawing once. A park that already has one
 * keeps it. A missing tracing photo is put back, because a new container
 * does not keep files from the last deploy.
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { MAPS_DIR, normalizeDocument, saveParkMap } = require('./parkMap');

const BUNDLES = [
  {
    venue: 'nh',
    revision: 'nh-draw-1',
    dir: path.join(__dirname, 'bundled-maps', 'nh'),
  },
];

async function installBundledMaps() {
  for (const bundle of BUNDLES) {
    const documentPath = path.join(bundle.dir, 'document.json');
    const referencePath = path.join(bundle.dir, 'reference.jpg');
    if (!fs.existsSync(documentPath)) continue;

    const location = await db.get('SELECT id FROM locations WHERE venue_code = ?', [bundle.venue]);
    if (!location) {
      console.log(`[map] no ${bundle.venue} park yet; the drawing waits until that park exists`);
      continue;
    }

    const row = await db.get('SELECT document FROM park_maps WHERE location_id = ?', [location.id]);
    let existing = null;
    if (row?.document) {
      try {
        existing = JSON.parse(row.document);
      } catch {
        existing = null;
      }
    }
    const count = Array.isArray(existing?.features) ? existing.features.length : 0;
    const dest = path.join(MAPS_DIR, location.id, 'reference.jpg');
    // A park that already has a drawing keeps it. The revision marks the copy
    // that shipped with the site, so an empty park still receives that copy.
    const installed = existing?.bundleRevision === bundle.revision || count >= 3;

    if (!installed) {
      const raw = JSON.parse(fs.readFileSync(documentPath, 'utf8'));
      raw.bundleRevision = bundle.revision;
      if (raw.reference) raw.reference.url = `/api/admin/locations/${location.id}/map/reference`;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (fs.existsSync(referencePath)) fs.copyFileSync(referencePath, dest);
      const normalized = normalizeDocument(raw, location.id);
      if (!normalized.reference || normalized.features.length < 200) {
        throw new Error(`bundled ${bundle.venue} map is incomplete (${normalized.features.length} features)`);
      }
      const saved = await saveParkMap(location.id, raw);
      if (!saved?.document?.reference || saved.document.features.length < 200) {
        throw new Error(`bundled ${bundle.venue} map did not save`);
      }
      console.log(`[map] installed ${bundle.venue} drawing (${saved.document.features.length} features)`);
      continue;
    }

    if (!fs.existsSync(dest) && fs.existsSync(referencePath)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(referencePath, dest);
      console.log(`[map] restored ${bundle.venue} tracing photo`);
    }
  }
}

module.exports = { installBundledMaps };
