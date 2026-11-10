const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

/** Shell files whose edits should mint a new guest-app build id in local/dev. */
const FINGERPRINT_FILES = [
  'public/index.html',
  'public/app.css',
  'public/sw.js',
  'public/js/app.js',
  'public/js/api.js',
  'public/js/map.js',
  'public/js/scanner.js',
  'public/js/guest-support.js',
  'public/js/wind-wisps.js',
  'public/manifest.webmanifest',
  'server/index.js',
  'server/routes/public.js',
  'server/questStations.js',
];

function computeBuildId() {
  const fromEnv = process.env.CQ_BUILD_ID
    || process.env.RENDER_GIT_COMMIT
    || process.env.SOURCE_VERSION;
  if (fromEnv) return String(fromEnv).trim().slice(0, 24);

  const hash = crypto.createHash('sha1');
  for (const rel of FINGERPRINT_FILES) {
    const full = path.join(ROOT, rel);
    try {
      const st = fs.statSync(full);
      hash.update(rel);
      hash.update(String(st.mtimeMs));
      hash.update(String(st.size));
    } catch {
      hash.update(rel);
      hash.update('missing');
    }
  }
  return hash.digest('hex').slice(0, 12);
}

function applyBuildToHtml(html, buildId) {
  // Bust shell CSS/JS (and any other ?v= asset) so browsers fetch the new deploy.
  return html.replace(
    /(\b(?:href|src)=")([^"?]+)\?v=[^"]+(")/g,
    `$1$2?v=${buildId}$3`
  );
}

function applyBuildToServiceWorker(source, buildId) {
  return source.replace(/__CQ_BUILD__/g, buildId);
}

function readServiceWorkerSource() {
  return fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
}

module.exports = {
  PUBLIC_DIR,
  computeBuildId,
  applyBuildToHtml,
  applyBuildToServiceWorker,
  readServiceWorkerSource,
};
