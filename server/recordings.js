/**
 * Guardian story recordings live on the data disk, not in the repo.
 * Meet uses touchpoints.audio_url. Discover uses discover_audio_url.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'recordings');

const KINDS = {
  meet: 'audio_url',
  discover: 'discover_audio_url',
};

const TYPES = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
  'audio/aac': '.m4a',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/wave': '.wav',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
};

function safeId(id) {
  return /^[A-Za-z0-9-]{8,80}$/.test(String(id || '')) ? String(id) : null;
}

function kindColumn(kind) {
  return KINDS[kind] || null;
}

function sniffType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return 'audio/mpeg';
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buffer.length >= 12 && buffer.slice(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF') return 'audio/wav';
  if (buffer.slice(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'audio/webm';
  return null;
}

function extensionFor(contentType, buffer) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return TYPES[type] || TYPES[sniffType(buffer)] || null;
}

function recordingFile(id, kind) {
  const safe = safeId(id);
  if (!safe || !KINDS[kind] || !fs.existsSync(DIR)) return null;
  const name = fs.readdirSync(DIR).find((entry) => entry.startsWith(`${safe}-${kind}.`));
  return name ? path.join(DIR, name) : null;
}

function removeFiles(id, kind) {
  if (!fs.existsSync(DIR)) return;
  for (const name of fs.readdirSync(DIR)) {
    if (name.startsWith(`${id}-${kind}.`)) fs.unlinkSync(path.join(DIR, name));
  }
}

function saveRecording(id, kind, buffer, contentType) {
  const safe = safeId(id);
  const ext = extensionFor(contentType, buffer);
  if (!safe || !KINDS[kind] || !ext || !buffer?.length) return null;
  fs.mkdirSync(DIR, { recursive: true });
  removeFiles(safe, kind);
  fs.writeFileSync(path.join(DIR, `${safe}-${kind}${ext}`), buffer);
  return `/recordings/${safe}/${kind}?v=${Date.now()}`;
}

function clearRecording(id, kind) {
  const safe = safeId(id);
  if (!safe || !KINDS[kind]) return false;
  removeFiles(safe, kind);
  return true;
}

module.exports = {
  kindColumn,
  recordingFile,
  saveRecording,
  clearRecording,
};
