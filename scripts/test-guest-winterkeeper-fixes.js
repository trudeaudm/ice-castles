#!/usr/bin/env node
/**
 * Focused checks for guest Winter Keeper fixes (offline snapshot, queue,
 * QR parsing, Spirit hidden stages, navigation generation, SW policy).
 * Run: node scripts/test-guest-winterkeeper-fixes.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const support = require('../public/js/guest-support.js');

/* ---------------- QR parsing ---------------- */
assert.deepStrictEqual(
  support.parseScanPayload('https://example.com/s/ABC123'),
  { kind: 'amenity', code: 'ABC123' }
);
assert.deepStrictEqual(
  support.parseScanPayload('https://example.com/nh/s/ABC123'),
  { kind: 'amenity', code: 'ABC123' }
);
assert.deepStrictEqual(
  support.parseScanPayload('https://park.example/nh/cascade'),
  { kind: 'station', venue: 'nh', slug: 'cascade' }
);
assert.deepStrictEqual(
  support.parseScanPayload('/mtl/aurora'),
  { kind: 'station', venue: 'mtl', slug: 'aurora' }
);
assert.deepStrictEqual(
  support.parseScanPayload('https://park.example/nh/#/scan/XYZ99'),
  { kind: 'amenity', code: 'XYZ99' }
);
assert.deepStrictEqual(
  support.parseScanPayload('https://park.example/nh?scan=XYZ99'),
  { kind: 'amenity', code: 'XYZ99' }
);
assert.deepStrictEqual(support.parseScanPayload('ABC123'), { kind: 'amenity', code: 'ABC123' });
assert.deepStrictEqual(support.parseScanPayload('not a code'), { kind: 'invalid' });
assert.strictEqual(support.legacyHashScan('#/scan/LEGACY1'), 'LEGACY1');
assert.strictEqual(support.legacyHashScan('#scan/LEGACY1'), 'LEGACY1');
assert.strictEqual(support.legacyHashScan('#/other'), null);

/* ---------------- Snapshot freshness / queue normalize ---------------- */
const today = support.operatingDateKey();
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
assert.strictEqual(
  support.isSnapshotFresh({
    guest: { token: 'g1' },
    operatingDate: today,
    session: { live: true, operatingDate: today },
  }),
  true
);
assert.strictEqual(
  support.isSnapshotFresh({
    guest: { token: 'g1' },
    operatingDate: '2000-01-01',
    session: { live: true, operatingDate: '2000-01-01' },
  }),
  false
);
assert.strictEqual(support.isSnapshotFresh({ operatingDate: today }), false);
assert.deepStrictEqual(
  support.normalizeQueueItem('abC9'),
  { code: 'ABC9', status: 'pending', queuedAt: 0 }
);
assert.strictEqual(support.normalizeQueueItem(''), null);

/* ---------------- Source policy checks (no browser) ---------------- */
const root = path.join(__dirname, '..');
const apiSrc = fs.readFileSync(path.join(root, 'public/js/api.js'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
const scannerSrc = fs.readFileSync(path.join(root, 'public/js/scanner.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'public/app.css'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
const questSrc = fs.readFileSync(path.join(root, 'server/quest.js'), 'utf8');

assert.match(apiSrc, /persistSnapshot/);
assert.match(apiSrc, /cacheKey\(token/);
assert.match(apiSrc, /async function flushQueue/);
assert.match(apiSrc, /async function reconcile/);
assert.match(apiSrc, /window\.addEventListener\('online'/);
assert.match(apiSrc, /clearLegacyCaches/);
assert.doesNotMatch(apiSrc, /read\(KEY_CACHE, null\)/);

assert.match(scannerSrc, /openGeneration/);
assert.match(scannerSrc, /pagehide/);
assert.match(scannerSrc, /visibilitychange/);
assert.match(scannerSrc, /generation !== openGeneration/);

assert.match(appSrc, /viewGeneration/);
assert.match(appSrc, /submitRuneArrangement/);
assert.match(appSrc, /selectRunePiece/);
assert.match(appSrc, /data-rune-retry/);
assert.match(appSrc, /setChromeInert/);
assert.match(appSrc, /trapModalFocus/);
assert.match(appSrc, /keepersSubmitting/);
assert.match(appSrc, /consumePendingScanDeepLink/);
assert.match(appSrc, /Store\.flushQueue/);
assert.doesNotMatch(appSrc, /Test mapping — replace when the physical station/);
assert.doesNotMatch(appSrc, /Email for a digital copy/);

assert.match(cssSrc, /\.spiritPlay__step\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSrc, /\.mapModal\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSrc, /\.scanner\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSrc, /\.award\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSrc, /\.finale\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSrc, /\.threshold\[hidden\]\s*\{\s*display:\s*none\s*!important/);
assert.match(cssSrc, /body\.quest\.landing-open/);

assert.match(swSrc, /isPrivateApi/);
assert.match(swSrc, /Never put guest\/session API/);
assert.doesNotMatch(swSrc, /url\.pathname\.startsWith\('\/api\/'\) \|\| isFreshPath/);

assert.match(serverSrc, /\?scan=\$\{encodeURIComponent\(code\)\}/);
assert.doesNotMatch(serverSrc, /#\/scan\/\$\{code\}/);

assert.match(questSrc, /Later: POST opted-in addresses to Keep/);
assert.match(questSrc, /async function sendToKeep\(_session\) \{\s*return null;/);

assert.match(indexSrc, /guest-support\.js\?v=1/);
assert.match(indexSrc, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="mapModalTitle"/);

/* ---------------- Simulated offline snapshot identity ---------------- */
function makeMemoryStore() {
  const bag = new Map();
  return {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
    key: (i) => [...bag.keys()][i] || null,
    get length() { return bag.size; },
    _bag: bag,
  };
}

const mem = makeMemoryStore();
const guestA = 'token-a';
const guestB = 'token-b';
const keyA = `ic.cache.v1:nh:active:${guestA}`;
const keyB = `ic.cache.v1:nh:active:${guestB}`;
mem.setItem(keyA, JSON.stringify({
  guest: { token: guestA },
  operatingDate: today,
  session: { live: true, operatingDate: today, realms: [{ complete: true }] },
  progress: { scans: [{ poiId: '1' }], tokens: [], completions: [] },
}));
mem.setItem(keyB, JSON.stringify({
  guest: { token: guestB },
  operatingDate: today,
  session: { live: true, operatingDate: today, realms: [] },
  progress: { scans: [], tokens: [], completions: [] },
}));

const loadedA = JSON.parse(mem.getItem(keyA));
assert.strictEqual(support.isSnapshotFresh(loadedA), true);
assert.notStrictEqual(loadedA.guest.token, guestB);
assert.strictEqual(JSON.parse(mem.getItem(keyB)).progress.scans.length, 0);

/* ---------------- Spirit stage visibility contract ---------------- */
assert.match(appSrc, /data-spirit-panel="enter" hidden/);
assert.match(appSrc, /function setSpiritStep\(root, step\)/);
assert.match(appSrc, /panel\.hidden = panel\.dataset\.spiritPanel !== step/);

/* ---------------- Navigation race contract ---------------- */
assert.match(appSrc, /if \(gen !== viewGeneration\)/);
assert.match(appSrc, /stillOnSpirit/);

/* ---------------- Completion error contract ---------------- */
assert.match(appSrc, /Could not finish just now/);
assert.match(appSrc, /Your names are still here/);

console.log('guest-winterkeeper-fixes checks passed');
