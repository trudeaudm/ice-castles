/* global window, document, Store, ParkMap, Scanner */

const ART = '/assets/art';
const REALM_META = {
  water: { label: 'Water', glyph: '💧', character: `${ART}/char-cascade.png`, pfp: `${ART}/pfp-cascade.png`, wave: `${ART}/wave-cascade.mp4` },
  earth: { label: 'Earth', glyph: '🪨', character: `${ART}/char-granite.png`, pfp: `${ART}/pfp-granite.png`, wave: `${ART}/wave-granite.mp4` },
  fire: { label: 'Fire', glyph: '🔥', character: `${ART}/char-ember.png`, pfp: `${ART}/pfp-ember.png`, wave: `${ART}/wave-ember.mp4` },
  air: { label: 'Air', glyph: '🌬️', character: `${ART}/char-summit.png`, pfp: `${ART}/pfp-summit.png`, wave: `${ART}/wave-summit.mp4` },
  spirit: { label: 'Spirit', glyph: '✦', character: `${ART}/char-aurora.png`, pfp: `${ART}/pfp-aurora.png`, wave: `${ART}/wave-aurora.mp4` },
};
/* Head crop inside the landing circle: source square as a fraction of frame width, top as a fraction of frame height. */
const WAVE_FACE = {
  water: { zoom: 0.72, top: 0.02 },
  earth: { zoom: 0.78, top: 0.0 },
  fire: { zoom: 0.7, top: 0.02 },
  air: { zoom: 0.7, top: 0.0 },
  spirit: { zoom: 0.72, top: 0.01 },
};
const REALM_ORDER = ['water', 'earth', 'fire', 'air', 'spirit'];
const TILE_ART = {
  'ice-vein': `${ART}/cascade-ice-vein.png`,
  'lantern-glow': `${ART}/cascade-lantern-glow.png`,
  'ice-arch': `${ART}/cascade-ice-arch.png`,
  'silk-wing': `${ART}/cascade-silk-wing.png`,
  'ice-ripple': `${ART}/cascade-ice-ripple.png`,
  'rune-cut': `${ART}/cascade-rune-cut.png`,
};
const LANTERN_ART = {
  ice: `${ART}/lantern-ice.png`,
  amber: `${ART}/lantern-amber.png`,
  rose: `${ART}/lantern-rose.png`,
  violet: `${ART}/lantern-violet.png`,
};

function realmIcon(realm, on = true) {
  return `${ART}/realm-${realm}-${on ? 'on' : 'off'}.png`;
}
function realmPfp(realm) {
  return REALM_META[realm]?.pfp || realmIcon(realm, true);
}
function realmCharacter(realm) {
  return REALM_META[realm]?.character || realmPfp(realm);
}
function realmPad(realm) {
  return `${ART}/pad-${realm}.png`;
}
function stationArt(station) {
  if (station.element && REALM_META[station.element]) return realmCharacter(station.element);
  if (station.imageUrl) return station.imageUrl;
  if (station.type === 'heart' || station.type === 'monument') return `${ART}/landing-gate.webp`;
  return '';
}

/* Swirl that holds a character's frame until the painting has decoded.
   The veil canvas is 128% of the frame so the poof can leave the picture. */
const SUMMON_PAD = 1.28;
const SUMMON_REALMS = {
  water: {
    spin: 1.25, shape: 'bubble',
    glow: 'rgba(255, 255, 255, 0.72)', arc: 'rgba(255, 255, 255, 0.95)', flash: '#ffffff',
    colors: ['#0e6eae', '#1478c4', '#1c86c9', '#0b5f98', '#3aa0d8'],
  },
  earth: {
    spin: 0.58, shape: 'leaf',
    glow: 'rgba(198, 214, 120, 0.42)', arc: 'rgba(226, 206, 130, 0.85)', flash: '#f6efc4',
    colors: ['#8fd06a', '#d2c06a', '#c4a15a', '#e7f0c4', '#6ea84a', '#f0e2b0'],
  },
  fire: {
    spin: 1.55, shape: 'ember',
    glow: 'rgba(255, 150, 40, 0.5)', arc: 'rgba(255, 206, 110, 0.9)', flash: '#fff1c4',
    colors: ['#fff6d2', '#ffd27a', '#ff9a3c', '#ff5a1a', '#ffe7a8'],
  },
  air: {
    spin: 1.95, shape: 'streak',
    glow: 'rgba(255, 255, 255, 0.38)', arc: 'rgba(255, 255, 255, 0.9)', flash: '#ffffff',
    colors: ['#ffffff', '#f4fbff', '#d5e6f0', '#ffffff', '#e7f2f8'],
  },
  spirit: {
    spin: 0.74, shape: 'star',
    glow: 'rgba(220, 180, 255, 0.5)', arc: 'rgba(240, 220, 255, 0.92)', flash: '#f7ecff',
    colors: ['#ffffff', '#f3e4ff', '#d7b4ff', '#e7d0ff', '#fff6ff'],
  },
  ice: {
    spin: 1.02, shape: 'crystal',
    glow: 'rgba(130, 196, 232, 0.4)', arc: 'rgba(70, 150, 204, 0.75)', flash: '#ffffff',
    colors: ['#ffffff', '#7ec4e6', '#2f86b8', '#d4eefb', '#e8f6ff'],
  },
};
const SUMMON_RATIO = {
  water: [1145, 1374],
  earth: [1024, 1536],
  fire: [1152, 1366],
  air: [1143, 1376],
  spirit: [1199, 1312],
  ice: [819, 1024],
};
const SUMMON_SWIRL_MS = 1500;
const SUMMON_FRAME_MS = 100;
const summonJobs = new Set();
let summonRaf = 0;

function summonHtml(src, className, realm, { hero = false } = {}) {
  const key = SUMMON_REALMS[realm] ? realm : 'ice';
  const [w, h] = SUMMON_RATIO[key];
  const portrait = className === 'shrine__portrait';
  const cls = `summon${portrait ? ' summon--portrait' : ''}${hero ? ' shrine__hero' : ''}`;
  const priority = hero ? ' fetchpriority="high"' : '';
  return `<div class="${cls}" data-realm="${escapeHtml(key)}" style="--summon-w:${w};--summon-h:${h}" aria-busy="true">
    <canvas class="summon__veil" width="2" height="2" aria-hidden="true"></canvas>
    <img class="${className}" src="${escapeHtml(src)}" alt=""${priority}>
  </div>`;
}

function summonVisible(frame) {
  if (!frame.isConnected || document.hidden) return false;
  if (document.body.classList.contains('landing-open')) return false;
  if (document.body.classList.contains('guide-open')) return false;
  const panel = frame.closest('.shrinePanel');
  if (panel && !panel.classList.contains('is-open')) return false;
  const rect = frame.getBoundingClientRect();
  return rect.width > 2 && rect.bottom > 0 && rect.top < window.innerHeight + 48;
}

function makeSummonParts(count, spec) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const r = 0.14 + Math.random() ** 0.7 * 0.86;
    parts.push({
      a: Math.random() * Math.PI * 2,
      r,
      w: (Math.random() < 0.14 ? -1 : 1) * (0.55 + (1 - r) * 1.75) * (0.72 + Math.random() * 0.7),
      size: (spec.shape === 'bubble' ? 5.5 : spec.shape === 'streak' ? 2.2 : 3.2)
        + Math.random() * (spec.shape === 'bubble' ? 8 : spec.shape === 'star' ? 5.5 : 4.6),
      color: spec.colors[(Math.random() * spec.colors.length) | 0],
      seed: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 1.7,
      spin: (Math.random() - 0.5) * 3.2,
      pebble: spec.shape === 'leaf' && Math.random() < 0.28,
    });
  }
  return parts;
}

function placeSummon(p, t, spec, R) {
  const a = p.a + t * p.w * spec.spin;
  let x = Math.cos(a) * p.r * R;
  let y = Math.sin(a) * p.r * R;
  let alpha = 0.62;
  let scale = 1;
  let rot = a;
  if (spec.shape === 'bubble') {
    y -= Math.sin(t * 1.5 + p.seed) * 8;
    scale = 0.9 + 0.22 * Math.sin(t * p.tw * 2 + p.seed);
    alpha = 0.88;
  } else if (spec.shape === 'leaf') {
    rot = t * p.spin + p.seed;
    y += Math.sin(t * 0.7 + p.seed) * 6;
    alpha = 0.82;
  } else if (spec.shape === 'ember') {
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(t * 8 * p.tw + p.seed));
    y -= R * 0.18 * (1.2 - p.r);
    alpha = flicker;
    scale = 0.72 + flicker * 0.5;
  } else if (spec.shape === 'streak') {
    x *= 1.08;
    y *= 0.68;
    rot = a + Math.PI / 2;
    alpha = 0.32 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + p.seed));
  } else if (spec.shape === 'star') {
    const tw = Math.abs(Math.sin(t * p.tw * 2.4 + p.seed));
    alpha = 0.22 + 0.78 * tw;
    scale = 0.62 + tw * 0.75;
    rot = t * 0.45 + p.seed;
  } else {
    rot = t * p.spin + p.seed;
    alpha = 0.4 + 0.55 * Math.abs(Math.sin(t * p.tw + p.seed));
  }
  return { x, y, alpha: Math.max(0, alpha), scale, rot };
}

function traceStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = rot + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.38;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function drawSummonMote(ctx, spec, p, x, y, alpha, scale) {
  if (alpha < 0.03) return;
  const size = Math.max(0.6, p.size * scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  if (p.spark || spec.shape === 'crystal') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.52, 0);
    ctx.lineTo(0, size * 1.2);
    ctx.lineTo(-size * 0.52, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  if (spec.shape === 'bubble') {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, size * 0.16);
    ctx.strokeStyle = p.color;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(x - size * 0.3, y - size * 0.32, Math.max(0.8, size * 0.26), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (spec.shape === 'leaf') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    if (p.pebble) ctx.ellipse(0, 0, size * 0.72, size * 0.52, 0, 0, Math.PI * 2);
    else ctx.ellipse(0, 0, size * 0.4, size * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!p.pebble) {
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = 'rgba(255, 248, 220, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (spec.shape === 'ember') {
    ctx.globalAlpha = alpha * 0.32;
    ctx.beginPath();
    ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = '#fff6d4';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, size * 0.26), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (spec.shape === 'streak') {
    const rot = p.rot || 0;
    const len = size * 4.4;
    const x2 = x + Math.cos(rot) * len;
    const y2 = y + Math.sin(rot) * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(24, 58, 84, 0.55)';
    ctx.lineWidth = Math.max(2.2, size * 0.85);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(rot) * len * 0.15, y - Math.sin(rot) * len * 0.15);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, size * 0.42);
    ctx.stroke();
    return;
  }
  traceStar(ctx, x, y, size * 1.15, p.rot || 0);
  ctx.fill();
}

function drawSummonField(job, t, fade) {
  const { ctx, cx, cy, R, spec } = job;
  ctx.clearRect(0, 0, job.cssW, job.cssH);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * spec.spin * 0.42);
  ctx.strokeStyle = spec.arc;
  ctx.globalAlpha = 0.62 * fade;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    ctx.rotate(2.12);
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.3 + i * 0.22), 0.2, 2.2);
    ctx.stroke();
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(cx, cy, R * 0.02, cx, cy, R * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.92)');
  glow.addColorStop(0.28, spec.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = (0.9 + Math.sin(t * 2.2) * 0.1) * fade;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.66, 0, Math.PI * 2);
  ctx.fill();
  for (const p of job.parts) {
    drawSummonMote(ctx, spec, p, p.x, p.y, p.alpha * fade, p.scale);
  }
  ctx.globalAlpha = 1;
}

function layoutSummon(job) {
  const canvas = job.canvas;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 2 || cssH < 2) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  job.ctx = ctx;
  job.cssW = cssW;
  job.cssH = cssH;
  job.cx = cssW / 2;
  job.cy = cssH / 2;
  job.R = (Math.min(cssW, cssH) / SUMMON_PAD) * 0.46;
  return job.R > 4;
}

function positionSwirl(job, t) {
  for (const p of job.parts) {
    const at = placeSummon(p, t, job.spec, job.R);
    p.x = job.cx + at.x;
    p.y = job.cy + at.y;
    p.alpha = at.alpha;
    p.scale = at.scale;
    p.rot = at.rot;
  }
}

function beginSummonPoof(job, now) {
  job.phase = 'poof';
  job.poofAt = now;
  job.frame.dataset.summonAt = String(now);
  job.frame.classList.add('is-shown');
  job.frame.setAttribute('aria-busy', 'false');
  const { cx, cy, spec } = job;
  for (const p of job.parts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const mag = Math.hypot(dx, dy) || 1;
    const kick = 78 + Math.random() * 90;
    p.vx = (dx / mag) * kick + (Math.random() - 0.5) * 28;
    p.vy = (dy / mag) * kick + (Math.random() - 0.5) * 28;
    p.px = p.x;
    p.py = p.y;
  }
  for (let i = 0; i < 16; i += 1) {
    const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.35;
    const kick = 40 + Math.random() * 100;
    job.parts.push({
      spark: true,
      px: cx,
      py: cy,
      vx: Math.cos(ang) * kick,
      vy: Math.sin(ang) * kick,
      size: 1.6 + Math.random() * 2.4,
      color: spec.colors[i % spec.colors.length],
      rot: ang,
      alpha: 1,
      scale: 1,
    });
  }
}

function drawSummonPoof(job, now) {
  const sec = (now - job.poofAt) / 1000;
  const life = Math.max(0, 1 - sec / 0.44);
  const { ctx, cx, cy, spec } = job;
  ctx.clearRect(0, 0, job.cssW, job.cssH);
  const flash = Math.max(0, 1 - sec / 0.24);
  ctx.globalAlpha = flash * 0.9;
  ctx.strokeStyle = spec.flash;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 6 + sec * 168, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = flash * 0.35;
  ctx.fillStyle = spec.flash;
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + sec * 70, 0, Math.PI * 2);
  ctx.fill();
  for (const p of job.parts) {
    const x = p.px + p.vx * sec;
    const y = p.py + p.vy * sec;
    const pop = (p.spark ? 1 : Math.max(0.7, p.alpha || 1)) * life;
    drawSummonMote(ctx, spec, p, x, y, pop, (p.scale || 1) * (1 + sec * 0.45));
  }
  ctx.globalAlpha = 1;
  if (sec >= 0.44) {
    job.canvas.remove();
    job.done = true;
  }
}

function showSummon(job, instant) {
  job.frame.dataset.summonAt = String(performance.now());
  job.frame.classList.add('is-shown');
  if (instant) job.frame.classList.add('is-instant');
  job.frame.setAttribute('aria-busy', 'false');
  if (job.canvas.isConnected) job.canvas.remove();
  job.done = true;
  job.phase = 'done';
}

function startSwirl(job, now) {
  job.phase = 'swirl';
  job.t0 = now;
  job.elapsed = 0;
  job.played = true;
  const rect = job.frame.getBoundingClientRect();
  const n = Math.round(Math.min(rect.width, rect.height) / 3.3);
  job.parts = makeSummonParts(Math.max(44, Math.min(92, n)), job.spec);
}

function stepSummon(job, now) {
  if (!job.frame.isConnected) {
    job.done = true;
    return;
  }
  if (job.phase === 'wait') {
    if (!job.ready && job.img.complete && job.img.naturalWidth > 0) job.ready = true;
    if (job.failed) {
      showSummon(job, true);
      return;
    }
    if (!summonVisible(job.frame)) return;
    startSwirl(job, now);
  }
  if (job.phase === 'swirl') {
    if (!summonVisible(job.frame) || !layoutSummon(job)) {
      job.seen = now;
      return;
    }
    if (job.seen) job.elapsed += Math.min(SUMMON_FRAME_MS, Math.max(0, now - job.seen));
    job.seen = now;
    const t = job.elapsed / 1000;
    positionSwirl(job, t);
    const ripe = (job.ready || job.failed || job.elapsed > 12000) && job.elapsed >= SUMMON_SWIRL_MS;
    if (ripe) {
      beginSummonPoof(job, now);
      drawSummonPoof(job, now);
      return;
    }
    drawSummonField(job, t, 1);
    return;
  }
  if (job.phase === 'poof') {
    if (!job.canvas.isConnected) {
      job.done = true;
      return;
    }
    if (!layoutSummon(job)) return;
    drawSummonPoof(job, now);
  }
}

function tickSummons(now) {
  summonRaf = 0;
  for (const job of summonJobs) stepSummon(job, now);
  for (const job of [...summonJobs]) if (job.done) summonJobs.delete(job);
  if (summonJobs.size) summonRaf = window.requestAnimationFrame(tickSummons);
}

function kickSummons() {
  if (!summonRaf && summonJobs.size) summonRaf = window.requestAnimationFrame(tickSummons);
}

function armSummon(frame) {
  if (frame.dataset.summonOn) return;
  frame.dataset.summonOn = '1';
  frame.classList.add('is-summoning');
  const img = frame.querySelector('img');
  const canvas = frame.querySelector('canvas');
  if (!img || !canvas) return;
  const realm = SUMMON_REALMS[frame.dataset.realm] ? frame.dataset.realm : 'ice';
  const job = {
    frame,
    img,
    canvas,
    spec: SUMMON_REALMS[realm],
    ready: img.complete && img.naturalWidth > 0,
    failed: img.complete && img.naturalWidth === 0,
    phase: 'wait',
    played: false,
    elapsed: 0,
    done: false,
  };
  if (!job.ready && !job.failed) {
    img.addEventListener('load', () => {
      const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
      decoded.then(() => { job.ready = true; }).catch(() => { job.ready = true; });
    }, { once: true });
    img.addEventListener('error', () => { job.failed = true; }, { once: true });
  }
  if (job.failed) {
    showSummon(job, true);
    return;
  }
  summonJobs.add(job);
  kickSummons();
}

function armSummons(root) {
  root.querySelectorAll('.summon').forEach(armSummon);
}

const el = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dom = {
  parkName: el('parkName'), parkLocation: el('parkLocation'),
  progressFill: el('progressFill'), progressLabel: el('progressLabel'),
  progressButton: el('progressButton'),
  questProgress: el('questProgress'), realmPips: el('realmPips'),
  stationView: el('stationView'),
  guideToggle: el('guideToggle'), headerMap: el('headerMap'), guide: el('guide'),
  sheet: el('sheet'), sheetBody: el('sheetBody'), sheetGrip: el('sheetGrip'),
  journeyPanel: el('journeyPanel'), journeyBody: el('journeyBody'),
  passportPanel: el('passportPanel'), passportBody: el('passportBody'),
  toast: el('toast'), splash: el('bootSplash'),
  scanFab: el('scanFab'), recenter: el('recenterButton'),
  filterButton: el('filterButton'), legend: el('legend'), legendRows: el('legendRows'),
  journeyButton: el('journeyButton'),
  threshold: el('threshold'), thresholdStart: el('thresholdStart'),
  landingPlace: el('landingPlace'), landingProgress: el('landingProgress'),
  landingHow: el('landingHow'), landingMap: el('landingMap'),
  landingHowto: el('landingHowto'), landingHowtoBody: el('landingHowtoBody'),
  landingHowtoClose: el('landingHowtoClose'),
  landingTalk: el('landingTalk'), landingBubble: el('landingBubble'),
  landingBubbleWho: el('landingBubbleWho'), landingBubbleText: el('landingBubbleText'),
  landingRealms: el('landingRealms'),
  mapModal: el('mapModal'), mapModalEyebrow: el('mapModalEyebrow'),
  mapModalTitle: el('mapModalTitle'), mapModalBody: el('mapModalBody'),
  mapModalPrimary: el('mapModalPrimary'), mapModalGhost: el('mapModalGhost'),
  finale: el('finale'), finaleCard: el('finaleCard'),
  award: el('award'), awardGlyph: el('awardGlyph'), awardTitle: el('awardTitle'),
  awardMeta: el('awardMeta'), awardKicker: el('awardKicker'), awardPips: el('awardPips'),
  awardDone: el('awardDone'),
};

let currentPanel = null;
let awardQueue = [];
let awardShowing = false;
let mapReady = false;
let selectedImages = new Set();
let sequenceBuffer = [];
let shrineFocus = null;
let shrineSlug = null;
let mapModalMode = null;
let mapModalStation = null;

const ICON_MEET = `<img src="${ART}/icon-meet.png" alt="">`;
const ICON_DISCOVER = `<img src="${ART}/icon-discover.png" alt="">`;
const ICON_PLAY = `<img src="${ART}/icon-play.png" alt="">`;

function setShrineFocus(key, { spin = true } = {}) {
  stopStoryAudio();
  shrineFocus = key;
  const gate = document.querySelector('.shrineGate');
  if (!gate) return;
  gate.dataset.focus = key;
  gate.classList.add('is-focus');
  if (spin) {
    gate.classList.remove('is-spinning');
    void gate.offsetWidth;
    gate.classList.add('is-spinning');
  }
  gate.querySelectorAll('[data-shrine-focus]').forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.shrineFocus === key);
  });
  document.querySelectorAll('.shrinePanel').forEach((panel) => {
    panel.classList.toggle('is-open', panel.dataset.panel === key);
  });
}

function toast(message, { warm = false, ms = 3200 } = {}) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle('is-warm', warm);
  dom.toast.classList.add('is-on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => dom.toast.classList.remove('is-on'), ms);
}

function goStation(slug) {
  const path = Store.stationPath(slug);
  if (`${location.pathname}` !== path) history.pushState({ station: slug }, '', path);
  Store.state.path = Store.pathContext();
  hideMapModal();
  openStation(slug);
}

function goVenueHome() {
  const path = Store.stationPath(null);
  if (`${location.pathname}` !== path) history.replaceState({ station: null }, '', path);
  Store.state.path = Store.pathContext();
}

/* Testing only: /nh?welcome (or /mtl?welcome) opens the hero again after a session exists. */
function wantsWelcomePreview() {
  return new URLSearchParams(location.search).has('welcome');
}

function stripWelcomePreview() {
  const params = new URLSearchParams(location.search);
  if (!params.has('welcome')) return;
  params.delete('welcome');
  const q = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
}

/* -------------------------------------------------------------------------- */
/* progress                                                                   */
/* -------------------------------------------------------------------------- */

function renderProgress() {
  const awakened = Store.realmsAwakened();
  const ratio = awakened / 5;
  const circumference = 2 * Math.PI * 18;
  dom.progressFill.style.strokeDasharray = String(circumference);
  dom.progressFill.style.strokeDashoffset = String(circumference * (1 - ratio));
  dom.progressLabel.textContent = String(awakened);
  dom.questProgress.textContent = `${awakened} of 5 Realms Awakened`;
  const realms = Store.state.session?.realms || [];
  dom.realmPips.innerHTML = REALM_ORDER.map((realm) => {
    const on = realms.some((r) => r.realm === realm && r.complete);
    return `<img class="realmPip ${on ? 'is-on' : ''}" src="${realmPfp(realm)}" alt="${REALM_META[realm].label}">`;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* shrine                                                                     */
/* -------------------------------------------------------------------------- */

function challengeHtml(station) {
  const type = station.challengeType;
  const challenge = station.challenge || {};
  if (!type || station.complete && station.type === 'guardian') {
    return station.type === 'guardian' && station.complete
      ? `<div class="challenge"><p class="challenge__prompt">This Realm is awake. Find the others, then scan The Heart.</p></div>`
      : '';
  }

  if (type === 'code_entry') {
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
      <div class="challenge__row">
        ${challenge.fieldLabel ? `<p class="challenge__field">${escapeHtml(challenge.fieldLabel)}</p>` : ''}
        <input class="challenge__input" data-challenge-code inputmode="latin" autocapitalize="characters"
               autocomplete="off" spellcheck="false" maxlength="24" placeholder="${escapeHtml(challenge.placeholder || 'WORD')}">
        <button class="textButton textButton--play" data-challenge-submit type="button">${escapeHtml(challenge.submitLabel || 'Go')}</button>
      </div>
    </div>`;
  }

  if (type === 'image_select') {
    const tiles = (challenge.images || []).map((img) => {
      const url = img.url || TILE_ART[img.id] || '';
      return `<button class="pickTile${url ? ' pickTile--art' : ''}" data-image-id="${escapeHtml(img.id)}" type="button" style="--tile:${escapeHtml(img.color || '#5df0cf')}">
        ${url ? `<img src="${escapeHtml(url)}" alt="">` : ''}
        <span>${escapeHtml(img.label || img.id)}</span>
      </button>`;
    }).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
      <div class="pickGrid">${tiles}</div>
      <button class="textButton textButton--play" data-image-submit type="button">Check my three</button>
    </div>`;
  }

  if (type === 'sequence' || type === 'multi_sequence') {
    const opts = (challenge.options || []).map((opt) => {
      const id = opt.id || opt;
      const label = opt.label || opt;
      const color = opt.color || '';
      const art = challenge.kind === 'color'
        ? LANTERN_ART[id]
        : (REALM_META[id] ? realmPad(id) : '');
      return `<button class="seqBtn${art ? ' seqBtn--art' : ''}" data-seq="${escapeHtml(id)}" type="button" style="${color ? `--tile:${escapeHtml(color)}` : ''}">
        ${art ? `<img src="${escapeHtml(art)}" alt="">` : ''}
        <span>${escapeHtml(label)}</span>
      </button>`;
    }).join('');
    const len = challenge.length || 5;
    const slots = Array.from({ length: len }, () =>
      '<span class="seqSlot" data-seq-slot><span class="seqSlot__dot"></span></span>'
    ).join('');
    const clearLabel = challenge.clearLabel || 'Clear';
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}" data-seq-len="${len}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
      ${challenge.kind === 'color'
        ? `<div class="seqSlots" data-seq-readout style="--slots:${len}" aria-label="Chosen lanterns">${slots}</div>`
        : '<p class="seqReadout" data-seq-readout>Tap the sequence</p>'}
      <div class="seqRow">${opts}</div>
      <button class="${challenge.clearLabel ? 'challenge__clear' : 'textButton'}" data-seq-clear type="button">${escapeHtml(clearLabel)}</button>
      ${challenge.submitLabel ? `<button class="textButton textButton--play" data-seq-submit type="button">${escapeHtml(challenge.submitLabel)}</button>` : ''}
    </div>`;
  }

  if (type === 'quiz') {
    const questions = (challenge.questions || []).map((q, qi) => `
      <fieldset class="quizQ">
        <legend>${escapeHtml(q.question)}</legend>
        ${(q.choices || []).map((c, ci) =>
          `<label class="quizChoice"><input type="radio" name="q${qi}" value="${ci}"> ${escapeHtml(c)}</label>`
        ).join('')}
      </fieldset>`).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${questions}
      <button class="textButton textButton--play" data-quiz-submit type="button">Finish quiz</button>
    </div>`;
  }

  return '';
}

function shrineMeetTitle(station) {
  if (station.type === 'guardian') return 'Meet the Guardian';
  if (station.type === 'monument') return 'Meet the builders';
  if (station.type === 'heart') return 'Meet the Heart';
  return `Meet ${station.title}`;
}

function shrineDiscoverTitle(station) {
  if (station.type === 'guardian') return 'Discover the Element';
  return 'Discover';
}

function storyHtml(text) {
  const parts = String(text || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return parts.map((part) => `<p>${escapeHtml(part)}</p>`).join('');
}

const LISTEN_ICON = `<svg class="listenButton__icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z" fill="currentColor"/>
  <path d="M16 9.2a4.2 4.2 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M18.4 6.8a7.2 7.2 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

function hearthHtml() {
  const src = `${ART}/ember-flames.mp4?v=2`;
  return `<video class="hearth__src" src="${src}" muted playsinline preload="auto" aria-hidden="true"></video>
    <video class="hearth__src" src="${src}" muted playsinline preload="auto" aria-hidden="true"></video>
    <canvas class="hearth" aria-hidden="true"></canvas>`;
}

function realmSkyHtml(element) {
  if (element === 'fire') {
    const embers = '<span class="ember"></span>'.repeat(14);
    return `<div class="realmSky" aria-hidden="true">${hearthHtml()}${embers}</div>`;
  }
  if (element === 'air') return airSkyHtml();
  if (element === 'spirit') return spiritSkyHtml();
  return `<div class="realmSky" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
}

function spiritSkyHtml() {
  const stars = [
    ['11%', '12%', '5px', '#ffffff', '1.05s', '-0.2s'],
    ['24%', '20%', '3px', '#d7b4ff', '1.35s', '-0.7s'],
    ['38%', '9%', '4px', '#7ef3ff', '1.15s', '-0.4s'],
    ['52%', '18%', '7px', '#fff4c8', '1.55s', '-1.1s'],
    ['67%', '11%', '3px', '#b8ffd4', '1.2s', '-0.3s'],
    ['81%', '16%', '5px', '#ffb7e8', '1.4s', '-0.9s'],
    ['16%', '36%', '4px', '#c9a6ff', '1.25s', '-0.5s'],
    ['33%', '44%', '3px', '#9af7ff', '1.1s', '-1.3s'],
    ['48%', '34%', '6px', '#ffffff', '1.6s', '-0.15s'],
    ['61%', '42%', '3px', '#e7ffb0', '1.3s', '-0.85s'],
    ['76%', '33%', '4px', '#ff9ad8', '1.45s', '-1.6s'],
    ['90%', '40%', '3px', '#d7b4ff', '1.2s', '-0.55s'],
  ];
  const marks = stars.map(([x, y, s, c, t, d]) =>
    `<i style="--x:${x};--y:${y};--s:${s};--c:${c};--t:${t};--d:${d}"></i>`
  ).join('');
  const veils = '<span></span>'.repeat(6);
  return `<div class="realmSky" aria-hidden="true"><div class="borealis" aria-hidden="true">${veils}</div>${marks}</div>`;
}

let windField = null;

function airSkyHtml() {
  return `<div class="realmSky" aria-hidden="true"><canvas class="wind" aria-hidden="true"></canvas></div>`;
}

function stopWind() {
  if (!windField) return;
  windField.stop();
  windField = null;
}

function startWind() {
  stopWind();
  const canvas = document.querySelector('.realmSky .wind');
  if (!canvas || typeof createWindWisps !== 'function') return;
  windField = createWindWisps(canvas, {
    direction: 0,
    speed: 1,
    density: 1,
    color: '#f4fbff',
    opacity: 0.8,
    trail: 1,
    spiral: 0.25,
    paused() {
      return document.body.classList.contains('map-moving')
        || document.body.classList.contains('guide-open')
        || document.body.classList.contains('landing-open');
    },
  });
  windField.start();
}

function listenButtonHtml(src) {
  const audio = src ? `<audio preload="none" src="${escapeHtml(src)}"></audio>` : '';
  return `<button class="listenButton" type="button" data-listen aria-pressed="false" aria-label="Play this story">
    ${LISTEN_ICON}<span class="listenButton__label">Listen</span>
  </button>
  ${audio}`;
}

let storyAudio = null;

function setListenButton(button, on) {
  button.classList.toggle('is-on', on);
  button.setAttribute('aria-pressed', on ? 'true' : 'false');
  button.setAttribute('aria-label', on ? 'Stop the recording' : 'Play this story');
  const label = button.querySelector('.listenButton__label');
  if (label) label.textContent = on ? 'Stop' : 'Listen';
}

function stopStoryAudio() {
  if (storyAudio) {
    storyAudio.pause();
    try { storyAudio.currentTime = 0; } catch { /* not loaded yet */ }
    storyAudio = null;
  }
  document.querySelectorAll('[data-listen].is-on').forEach((button) => setListenButton(button, false));
}

function playStory(button) {
  const audio = button.nextElementSibling;
  if (!(audio instanceof HTMLAudioElement)) return;
  if (button.classList.contains('is-on')) {
    stopStoryAudio();
    return;
  }
  stopStoryAudio();
  storyAudio = audio;
  setListenButton(button, true);
  audio.onended = () => {
    if (storyAudio !== audio) return;
    storyAudio = null;
    setListenButton(button, false);
  };
  audio.play().catch(() => {
    if (storyAudio === audio) storyAudio = null;
    setListenButton(button, false);
    toast('Couldn’t play that recording.');
  });
}

let hearthGen = 0;

function stopHearth() {
  hearthGen += 1;
  document.querySelectorAll('.hearth__src').forEach((video) => video.pause());
}

function punchGreen(data, width, height) {
  const count = width * height;
  const solid = new Uint8Array(count);
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const spill = g - Math.max(r, b);
    if (spill > 8 || data[i + 3] < 16) {
      data[i + 3] = 0;
    } else {
      if (spill > 0) data[i + 1] = Math.max(r, b);
      solid[p] = 1;
    }
  }
  const erode = (src) => {
    const dst = new Uint8Array(count);
    for (let y = 1; y < height - 1; y += 1) {
      const row = y * width;
      for (let x = 1; x < width - 1; x += 1) {
        const p = row + x;
        if (src[p] && src[p - 1] && src[p + 1] && src[p - width] && src[p + width]) dst[p] = 1;
      }
    }
    return dst;
  };
  const inner = erode(erode(solid));
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const p = row + x;
      const i = p * 4 + 3;
      if (!inner[p]) {
        data[i] = 0;
        continue;
      }
      const edge = !inner[p - 1] || !inner[p + 1] || !inner[p - width] || !inner[p + width];
      data[i] = edge ? 160 : 255;
    }
  }
  for (let x = 0; x < width; x += 1) data[x * 4 + 3] = data[((height - 1) * width + x) * 4 + 3] = 0;
  for (let y = 0; y < height; y += 1) data[(y * width) * 4 + 3] = data[(y * width + width - 1) * 4 + 3] = 0;
}

const HEARTH_BLEND = 0.85;

function blendHearth(dst, src, mix) {
  const keep = 1 - mix;
  for (let i = 0; i < dst.length; i += 4) {
    const lead = dst[i + 3] * keep;
    const follow = src[i + 3] * mix;
    const out = lead + follow;
    if (out < 1) {
      dst[i + 3] = 0;
      continue;
    }
    dst[i] = (dst[i] * lead + src[i] * follow) / out;
    dst[i + 1] = (dst[i + 1] * lead + src[i + 1] * follow) / out;
    dst[i + 2] = (dst[i + 2] * lead + src[i + 2] * follow) / out;
    dst[i + 3] = out;
  }
}

function startHearth() {
  const canvas = document.querySelector('.realmSky .hearth');
  const videos = [...document.querySelectorAll('.realmSky .hearth__src')];
  let primary = videos[0];
  let secondary = videos[1] || null;
  if (!canvas || !primary) return;
  const gen = ++hearthGen;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scratch = document.createElement('canvas');
  const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  let lit = false;
  let bridging = false;
  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = false;
    video.playsInline = true;
  });
  const play = (video) => {
    if (video && video.paused && !video.ended && video.readyState >= 2) video.play().catch(() => {});
  };
  const paint = () => {
    if (gen !== hearthGen || !canvas.isConnected) return;
    try {
    const held = document.body.classList.contains('map-moving')
      || document.body.classList.contains('guide-open')
      || document.body.classList.contains('landing-open');
    if (held) {
      videos.forEach((video) => { if (!video.paused) video.pause(); });
    } else {
      play(primary);
      if (bridging) play(secondary);
    }
    if (!held && primary.readyState >= 2 && primary.videoWidth) {
      const dur = primary.duration;
      const blend = Number.isFinite(dur) ? Math.min(HEARTH_BLEND, dur * 0.2) : 0;
      const remaining = Number.isFinite(dur) ? dur - primary.currentTime : Infinity;
      if (secondary && blend > 0.2 && remaining <= blend && !bridging && !primary.ended) {
        bridging = true;
        const into = Math.max(0, blend - remaining);
        const begin = () => {
          if (gen !== hearthGen || !bridging) return;
          play(secondary);
        };
        if (Math.abs(secondary.currentTime - into) > 0.05) {
          secondary.addEventListener('seeked', begin, { once: true });
          try { secondary.currentTime = into; } catch { begin(); }
        } else begin();
      }
      const vw = primary.videoWidth;
      const vh = primary.videoHeight;
      const cropTop = Math.round(vh * 0.30);
      const cropBottom = Math.round(vh * 0.955);
      const cropH = cropBottom - cropTop;
      const scale = Math.min(1, 640 / vw);
      const w = Math.round(vw * scale);
      const h = Math.round(cropH * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(primary, 0, cropTop, vw, cropH, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h);
      punchGreen(frame.data, w, h);
      const still = Number.isFinite(dur) ? dur - primary.currentTime : Infinity;
      if (bridging && secondary && secondary.readyState >= 2 && secondary.videoWidth && still <= blend) {
        if (scratch.width !== w || scratch.height !== h) {
          scratch.width = w;
          scratch.height = h;
        }
        const sw = secondary.videoWidth;
        const sh = secondary.videoHeight;
        scratchCtx.drawImage(secondary, 0, Math.round(sh * 0.30), sw, Math.round(sh * 0.955) - Math.round(sh * 0.30), 0, 0, w, h);
        const incoming = scratchCtx.getImageData(0, 0, w, h);
        punchGreen(incoming.data, w, h);
        blendHearth(frame.data, incoming.data, Math.min(1, Math.max(0, (blend - still) / blend)));
      }
      ctx.putImageData(frame, 0, 0);
      if (primary.ended || (bridging && remaining <= 0.03)) {
        if (secondary && bridging && secondary.readyState >= 2 && secondary.currentTime > 0.01) {
          const outgoing = primary;
          primary = secondary;
          secondary = outgoing;
          bridging = false;
          secondary.pause();
          try { secondary.currentTime = 0; } catch { /* next blend seeks again */ }
        } else if (primary.ended) {
          bridging = false;
          try { primary.currentTime = 0; } catch { /* replay from the start */ }
          primary.play().catch(() => {});
        }
      }
      if (!lit) {
        lit = true;
        const rise = canvas.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 900, easing: 'ease', fill: 'forwards' },
        );
        rise.onfinish = () => {
          canvas.style.opacity = '1';
          rise.cancel();
        };
      }
      }
    } catch {
      /* keep the next frame coming if one paint fails */
    }
    requestAnimationFrame(paint);
  };
  const boot = () => {
    if (gen !== hearthGen) return;
    primary.play().catch(() => {});
    if (secondary) {
      secondary.play().then(() => {
        if (gen !== hearthGen || bridging) return;
        secondary.pause();
        try { secondary.currentTime = 0; } catch { /* kept warm */ }
      }).catch(() => {});
    }
    requestAnimationFrame(paint);
  };
  if (primary.readyState >= 2) boot();
  else primary.addEventListener('loadeddata', boot, { once: true });
}

function renderStation(slug) {
  stopStoryAudio();
  stopHearth();
  stopWind();
  if (!document.body.classList.contains('landing-open')) haltWaves();
  const station = Store.touchBySlug(slug) || Store.touchByType('threshold')[0];
  if (!station) {
    delete document.body.dataset.realm;
    dom.stationView.innerHTML = `<div class="empty"><p class="empty__title">This station isn’t on tonight’s quest.</p></div>`;
    return;
  }
  if (station.type === 'guardian' && station.element) document.body.dataset.realm = station.element;
  else delete document.body.dataset.realm;

  if (shrineSlug !== station.slug) {
    shrineSlug = station.slug;
    shrineFocus = null;
  }

  const gated = station.type === 'guardian' || station.type === 'monument';
  const playHtml = station.challengeType ? challengeHtml(station) : '';
  const extra = station.type === 'monument' && Store.state.session?.builderQuizAt
    ? `<p class="fineprint">You finished the builder quiz. This stop is optional.</p>`
    : '';
  const art = stationArt(station);
  const portrait = station.element ? realmCharacter(station.element) : '';
  const sky = station.type === 'guardian' ? realmSkyHtml(station.element) : '';
  const waveRealm = station.type === 'guardian' && REALM_META[station.element]?.wave ? station.element : '';
  const artHtml = art ? summonHtml(art, 'shrine__art', station.element, { hero: Boolean(waveRealm) }) : '';

  if (!gated) {
    dom.stationView.innerHTML = `
      <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
        <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
        <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
        ${artHtml}
        <section class="shrine__block">
          <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
          ${storyHtml(station.body)}
        </section>
        ${station.discoverBody ? `<section class="shrine__block">
          <h3>${escapeHtml(shrineDiscoverTitle(station))}</h3>
          ${storyHtml(station.discoverBody)}
        </section>` : ''}
        <div id="heartSlot"></div>
      </article>`;
    if (station.type === 'heart') renderHeartSlot();
    armSummons(dom.stationView);
    return;
  }

  dom.stationView.innerHTML = `
    <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
      ${sky}
      <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
      <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
      ${station.element ? `<p class="chip chip--target">${escapeHtml(REALM_META[station.element]?.label || station.element)}</p>` : ''}
      ${artHtml}
      <div class="shrineGate" data-focus="">
        <button class="shrineIcon" data-shrine-focus="meet" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_MEET}</span>
          <span class="shrineIcon__label">Meet</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="discover" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_DISCOVER}</span>
          <span class="shrineIcon__label">Discover</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="play" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem shrineIcon__gem--play">${ICON_PLAY}</span>
          <span class="shrineIcon__label">Play</span>
        </button>
      </div>
      <section class="shrinePanel" data-panel="meet">
        <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
        ${station.type === 'guardian' ? listenButtonHtml(station.audioUrl) : ''}
        ${portrait ? summonHtml(portrait, 'shrine__portrait', station.element) : ''}
        ${storyHtml(station.body)}
      </section>
      <section class="shrinePanel" data-panel="discover">
        <h3>${escapeHtml(shrineDiscoverTitle(station))}</h3>
        ${station.type === 'guardian' ? listenButtonHtml(station.discoverAudioUrl) : ''}
        ${storyHtml(station.discoverBody || 'Look around this shrine. The castle keeps its own clues.')}
      </section>
      <section class="shrinePanel" data-panel="play" id="challenge">
        <h3>Play the challenge</h3>
        ${playHtml}
        ${extra}
      </section>
    </article>`;

  selectedImages = new Set();
  sequenceBuffer = [];
  if (shrineFocus) setShrineFocus(shrineFocus, { spin: false });
  armSummons(dom.stationView);
  if (waveRealm && !document.body.classList.contains('landing-open')) armShrineWaves(waveRealm);
  if (station.element === 'fire') startHearth();
  if (station.element === 'air') startWind();
}

async function openStation(slug, { recordVisit = true } = {}) {
  hideThreshold();
  hideMapModal();
  closePanels();
  closeGuide({ force: true });
  Store.setIntendedStation(slug);
  renderStation(slug);
  if (recordVisit && Store.hasLiveSession() && slug) {
    try { await Store.visitStation(slug); renderProgress(); } catch { /* offline */ }
    if (slug === 'heart' || Store.touchBySlug(slug)?.type === 'heart') {
      const result = await Store.scanHeart();
      renderStation(slug);
      renderHeartSlot(result);
    }
  }
}

function renderHeartSlot(heartResult) {
  const slot = el('heartSlot');
  if (!slot) return;
  const session = Store.state.session;
  if (!session?.live) return;

  if (session.winterKeeper) {
    slot.innerHTML = staffScreenHtml(session);
    return;
  }

  const remaining = (heartResult?.remaining)
    || (session.realms || []).filter((r) => !r.complete).map((r) => r.realm);

  if (remaining.length) {
    const names = remaining.map((r) => REALM_META[r]?.label || r);
    const icons = remaining.map((r) =>
      `<li><img src="${realmPfp(r)}" alt=""><span>${escapeHtml(REALM_META[r]?.label || r)}</span></li>`
    ).join('');
    slot.innerHTML = `<div class="challenge">
      <p class="challenge__prompt">The Heart is still sleeping. ${names.length === 1 ? 'This Realm' : 'These Realms'} remain:</p>
      <ul class="remainList">${icons}</ul>
      <button class="textButton" data-open-journey type="button">View my journey</button>
    </div>`;
    return;
  }

  slot.innerHTML = keepersFormHtml();
}

function keepersFormHtml() {
  return `<form class="challenge keepers" id="keepersForm">
    <p class="challenge__prompt">The Heart is open. Enter the Winter Keepers in your party.</p>
    <label>How many adventurers?
      <input class="challenge__input" name="partySize" type="number" min="1" max="20" value="1" required>
    </label>
    <label>First names
      <input class="challenge__input" name="names" placeholder="Ada, Sam, Juniper" required>
    </label>
    <label>Email for the digital seal (optional)
      <input class="challenge__input" name="email" type="email" autocomplete="email">
    </label>
    <label class="check">
      <input type="checkbox" name="marketing">
      <span>Also send Ice Castles news to this address. Separate from the digital reward.</span>
    </label>
    <button class="threshold__primary threshold__primary--earned" type="submit">Become Winter Keepers</button>
  </form>`;
}

function staffScreenHtml(session) {
  const names = session.keeperNames || [];
  const park = Store.state.park || {};
  return `<div class="staffCard">
    <p class="staffCard__kicker">Show this at the Gear Shop</p>
    <h3>Winter Keepers</h3>
    <p class="staffCard__names">${escapeHtml(names.join(' · ') || 'This party')}</p>
    <p class="staffCard__count">${session.partySize || names.length || 1} adventurer${(session.partySize || 1) === 1 ? '' : 's'}</p>
    <p class="fineprint">${escapeHtml(park.badgeRedemption || 'One physical reward per adventurer.')}</p>
  </div>`;
}

function sealHtml(session) {
  const names = (session.keeperNames || []).join(', ') || 'Winter Keepers';
  const park = Store.state.park || {};
  const year = Store.state.adventure?.year || '';
  return `<div class="seal">
    <img class="seal__art" src="${ART}/seal-winter-keeper.png" alt="">
    <img class="seal__wordmark" src="${ART}/wordmark-winter-keeper.png" alt="Winter Keeper">
    <h2 class="seal__names">${escapeHtml(names)}</h2>
    <p class="seal__meta">${escapeHtml(park.locationName || park.name || '')} · ${escapeHtml(String(year))}</p>
  </div>`;
}

async function submitKeepers(form) {
  const names = String(form.names.value || '').split(/[,;/]+/).map((n) => n.trim()).filter(Boolean);
  const partySize = Number(form.partySize.value || names.length || 1);
  await Store.finishQuest({
    names,
    partySize,
    email: form.email.value || null,
    marketingOptIn: form.marketing.checked,
  });
  renderProgress();
  renderHeartSlot();
  showFinale();
}

function showFinale() {
  const session = Store.state.session;
  if (!session?.winterKeeper) return;
  dom.finaleCard.innerHTML = `
    <div class="finaleStage">
      ${sealHtml(session)}
      <p class="finaleStage__lead">The castle knows your names. Continue, then show the next screen at the Gear Shop.</p>
      <button class="threshold__primary threshold__primary--earned finaleStage__btn" data-show-reward type="button">Continue</button>
    </div>`;
  dom.finale.hidden = false;
  requestAnimationFrame(() => dom.finale.classList.add('is-open'));
}

function showReward() {
  const session = Store.state.session;
  dom.finaleCard.innerHTML = `
    <div class="finaleStage finaleStage--staff">
      ${staffScreenHtml(session)}
      <button class="textButton finaleStage__btn" data-close-finale type="button">Done</button>
    </div>`;
}

function hideFinale() {
  dom.finale.classList.remove('is-open');
  setTimeout(() => { dom.finale.hidden = true; }, 320);
  if (Store.state.session?.winterKeeper) renderHeartSlot();
}

/* -------------------------------------------------------------------------- */
/* journey dashboard                                                          */
/* -------------------------------------------------------------------------- */

function renderJourney() {
  const stations = Store.state.touchpoints || [];
  const session = Store.state.session;
  const rows = stations.map((tp) => {
    let status = 'Visit';
    if (tp.type === 'heart') status = session?.winterKeeper ? 'Complete' : session?.realmsComplete ? 'Ready to scan' : 'Final destination';
    else if (tp.type === 'monument') status = session?.builderQuizAt ? 'Quiz done' : session?.buildersVisitedAt ? 'Visited' : 'Optional';
    else if (tp.type === 'threshold') status = session ? 'Welcome' : 'Start here';
    else if (tp.complete) status = 'Realm awake';
    return `<li>
      <button class="stop ${tp.complete || (tp.type === 'heart' && session?.winterKeeper) ? 'is-found' : 'is-secret'}" data-go-station="${escapeHtml(tp.slug)}" type="button">
        <span class="stop__token">${
          tp.element
            ? `<img src="${realmPfp(tp.element)}" alt="">`
            : (tp.type === 'heart' ? `<img src="${ART}/seal-winter-keeper.png" alt="">` : tp.type === 'monument' ? `<img src="${ART}/pin-park.png" alt="">` : '◇')
        }</span>
        <span>
          <p class="stop__name">${escapeHtml(tp.title)}</p>
          <p class="stop__hint">${escapeHtml(status)}</p>
        </span>
      </button>
    </li>`;
  }).join('');

  dom.journeyBody.innerHTML = `
    <p class="sectionLabel">Castle Quest</p>
    <p class="fineprint" style="margin-bottom:16px">${Store.realmsAwakened()} of 5 Realms Awakened. Builder’s Monument is optional. The Heart finishes the quest.</p>
    <ul class="stopList">${rows}</ul>`;
}

function openPanel(name) {
  closeGuide();
  ['journeyPanel', 'passportPanel'].forEach((key) => {
    if (!dom[key]) return;
    dom[key].hidden = true;
    dom[key].classList.remove('is-open');
  });
  if (name === 'journey') { renderJourney(); showPanel(dom.journeyPanel); }
  else if (name === 'passport') { renderPassport(); showPanel(dom.passportPanel); }
  currentPanel = name;
  document.body.classList.add('panel-open');
}

function showPanel(panel) {
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function closePanels() {
  ['journeyPanel', 'passportPanel'].forEach((key) => {
    if (!dom[key]) return;
    dom[key].classList.remove('is-open');
    setTimeout(() => { dom[key].hidden = true; }, 440);
  });
  currentPanel = null;
  document.body.classList.remove('panel-open');
}

function renderPassport() {
  const session = Store.state.session;
  const park = Store.state.park || {};
  dom.passportBody.innerHTML = session?.winterKeeper
    ? `${staffScreenHtml(session)}<p class="fineprint">${escapeHtml(park.badgeBody || '')}</p>`
    : `<div class="empty">
        <h3 class="empty__title">Not a Winter Keeper yet</h3>
        <p class="empty__body">Awaken five Realms, then scan The Heart. Progress lasts until 4 AM Eastern.</p>
      </div>`;
}

/* -------------------------------------------------------------------------- */
/* threshold / guide                                                          */
/* -------------------------------------------------------------------------- */

const LANDING_FACTS = {
  water: [
    { who: 'Cascade', text: 'Water is the trickiest ice to grow — it has to look like it’s still pouring!' },
    { who: 'Cascade', text: 'Hunt for veins, ripples, and arches pressed into the walls beside you.' },
    { who: 'Cascade', text: 'The lights in this realm cycle like a current under the ice.' },
  ],
  earth: [
    { who: 'Granite', text: 'The runes are carved, not printed — they change as you walk past.' },
    { who: 'Granite', text: 'A single archway can take two people most of a night to grow.' },
    { who: 'Granite', text: 'Four moose hide nearby. Each one holds a letter of a builder’s word.' },
  ],
  fire: [
    { who: 'Ember', text: 'Nothing here is actually burning — amber silk and LEDs do the flicker.' },
    { who: 'Ember', text: 'Three dragons roost on the horse path. Count the fire lizards if you can!' },
    { who: 'Ember', text: 'Those lizards are printed in-house. No two sit the same way twice.' },
  ],
  air: [
    { who: 'Summit', text: 'A finished castle can hold more than twenty million pounds of ice.' },
    { who: 'Summit', text: 'Artists harvest icicles by hand each night, then spray them until they fuse.' },
    { who: 'Summit', text: 'Look up in the Aviary — every silk bird is painted by hand, and no two match.' },
  ],
  spirit: [
    { who: 'Aurora', text: 'The Tundra stays dark on purpose. Give your eyes thirty seconds.' },
    { who: 'Aurora', text: 'Everything you see was grown, not built — water, cold, and time.' },
    { who: 'Aurora', text: 'Fairy Village doors are kid-height, and every silk is a different color.' },
  ],
};

const talkCursor = { water: 0, earth: 0, fire: 0, air: 0, spirit: 0 };
let talkDelay = 0;
let talkPulse = 0;
let talkHide = 0;

/* -------------------------------------------------------------------------- */
/* guardian wave clips — muted, one at a time                                */
/* -------------------------------------------------------------------------- */

let waveGen = 0;
let waveTimer = 0;
let waveRaf = 0;
let waveBag = [];
let waveLast = '';

function nextWaveRealm() {
  if (!waveBag.length) {
    waveBag = REALM_ORDER.filter((realm) => realm !== waveLast);
    for (let i = waveBag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [waveBag[i], waveBag[j]] = [waveBag[j], waveBag[i]];
    }
  }
  waveLast = waveBag.pop();
  return waveLast;
}

function waveVideoEl() {
  if (waveVideoEl.el) return waveVideoEl.el;
  const video = document.createElement('video');
  video.className = 'waveSource';
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  document.body.appendChild(video);
  waveVideoEl.el = video;
  return video;
}

function silenceWave(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  try {
    const tracks = video.audioTracks;
    if (tracks) {
      for (let i = 0; i < tracks.length; i += 1) tracks[i].enabled = false;
    }
  } catch { /* not supported */ }
}

function isBackdrop(r, g, b) {
  const m = r > g ? (r > b ? r : b) : (g > b ? g : b);
  // Near-black only. Granite's fur is dark brown and shares an edge with the
  // vignette, so a wider match eats his legs.
  return m < 18;
}

function keyBackdrop(image) {
  const { data, width: w, height: h } = image;
  const count = w * h;
  if (keyBackdrop.n !== count) {
    keyBackdrop.n = count;
    keyBackdrop.bg = new Uint8Array(count);
    keyBackdrop.qx = new Int16Array(count);
    keyBackdrop.qy = new Int16Array(count);
  }
  const bg = keyBackdrop.bg;
  bg.fill(0);
  const qx = keyBackdrop.qx;
  const qy = keyBackdrop.qy;
  let qe = 0;
  let qs = 0;
  const push = (x, y) => {
    const p = y * w + x;
    if (bg[p]) return;
    const i = p * 4;
    if (!isBackdrop(data[i], data[i + 1], data[i + 2])) return;
    bg[p] = 1;
    qx[qe] = x;
    qy[qe] = y;
    qe += 1;
  };
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    if (h > 1) push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    if (w > 1) push(w - 1, y);
  }
  while (qs < qe) {
    const x = qx[qs];
    const y = qy[qs];
    qs += 1;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }
  for (let p = 0; p < count; p += 1) {
    if (bg[p]) data[p * 4 + 3] = 0;
  }
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = y * w + x;
      if (bg[p]) continue;
      if (!(bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w])) continue;
      const i = p * 4;
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      if (m < 42) data[i + 3] = Math.round((m / 42) * 255);
    }
  }
  return image;
}

function paintWaveFrame(canvas, video, mode, realm) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  ctx.clearRect(0, 0, w, h);
  if (mode === 'face') {
    const crop = WAVE_FACE[realm] || { zoom: 0.74, top: 0.02 };
    const side = vw * crop.zoom;
    ctx.drawImage(video, (vw - side) / 2, vh * crop.top, side, side, 0, 0, w, h);
  } else {
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  ctx.putImageData(keyBackdrop(ctx.getImageData(0, 0, w, h)), 0, 0);
}

function sizeWaveCanvas(canvas, cssW, cssH) {
  const maxEdge = cssH > 140 ? 420 : 240;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.max(2, Math.round(cssW * dpr));
  let h = Math.max(2, Math.round(cssH * dpr));
  const edge = Math.max(w, h);
  if (edge > maxEdge) {
    const fit = maxEdge / edge;
    w = Math.max(2, Math.round(w * fit));
    h = Math.max(2, Math.round(h * fit));
  }
  canvas.width = w;
  canvas.height = h;
}

function loadWave(video, realm) {
  const src = REALM_META[realm]?.wave;
  if (!src) return Promise.reject(new Error('wave'));
  silenceWave(video);
  if (video.getAttribute('data-src') === src && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('wave')); };
    const cleanup = () => {
      video.removeEventListener('loadeddata', ok);
      video.removeEventListener('error', bad);
    };
    video.addEventListener('loadeddata', ok);
    video.addEventListener('error', bad);
    video.setAttribute('data-src', src);
    video.src = src;
    video.load();
  });
}

function haltWaves() {
  waveGen += 1;
  window.clearTimeout(waveTimer);
  window.cancelAnimationFrame(waveRaf);
  waveRaf = 0;
  const video = waveVideoEl.el;
  if (video) {
    video.onended = null;
    video.pause();
    silenceWave(video);
  }
  document.querySelectorAll('.is-waving').forEach((node) => node.classList.remove('is-waving'));
  document.querySelectorAll('.landing__wave, .shrine__wave').forEach((node) => node.remove());
}

async function runWave(realm, mode, paintHost, wavingHost, gen) {
  const video = waveVideoEl();
  silenceWave(video);
  await loadWave(video, realm);
  if (gen !== waveGen || !paintHost.isConnected) return;
  silenceWave(video);
  if (video.currentTime > 0.04) {
    await new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
      try { video.currentTime = 0; } catch { resolve(); }
    });
  }
  if (gen !== waveGen || !paintHost.isConnected) return;
  const canvas = document.createElement('canvas');
  canvas.className = mode === 'face' ? 'landing__wave' : 'shrine__wave';
  canvas.setAttribute('aria-hidden', 'true');
  paintHost.appendChild(canvas);
  if (mode === 'face') sizeWaveCanvas(canvas, paintHost.offsetWidth, paintHost.offsetHeight);
  else {
    const img = paintHost.querySelector('.shrine__art');
    sizeWaveCanvas(canvas, img?.offsetWidth || paintHost.offsetWidth, img?.offsetHeight || paintHost.offsetHeight);
  }
  if (canvas.width < 2 || canvas.height < 2) {
    canvas.remove();
    return;
  }
  paintWaveFrame(canvas, video, mode, realm);
  wavingHost.classList.add('is-waving');
  try {
    await video.play();
  } catch {
    wavingHost.classList.remove('is-waving');
    canvas.remove();
    return;
  }
  silenceWave(video);
  const natural = await new Promise((resolve) => {
    let safety = 0;
    const finish = (ok) => {
      window.clearTimeout(safety);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('pause', onPause);
      resolve(ok);
    };
    const onEnd = () => finish(gen === waveGen);
    const onPause = () => {
      if (gen !== waveGen || video.ended) finish(gen === waveGen && video.ended);
    };
    video.addEventListener('ended', onEnd);
    video.addEventListener('pause', onPause);
    safety = window.setTimeout(() => finish(false), 8000);
    const draw = () => {
      if (gen !== waveGen || video.ended || !canvas.isConnected) return;
      if (!video.muted || video.volume !== 0) silenceWave(video);
      paintWaveFrame(canvas, video, mode, realm);
      waveRaf = window.requestAnimationFrame(draw);
    };
    waveRaf = window.requestAnimationFrame(draw);
  });
  wavingHost.classList.remove('is-waving');
  if (natural) await new Promise((resolve) => window.setTimeout(resolve, 220));
  if (canvas.isConnected) canvas.remove();
}

function landingCanWave() {
  return document.body.classList.contains('landing-open')
    && Boolean(dom.threshold?.classList.contains('is-open'))
    && !(dom.landingHowto && !dom.landingHowto.hidden);
}

function armLandWaves() {
  const gen = waveGen;
  const tick = (delay) => {
    window.clearTimeout(waveTimer);
    waveTimer = window.setTimeout(async () => {
      if (gen !== waveGen) return;
      if (!landingCanWave()) {
        tick(900);
        return;
      }
      const realm = nextWaveRealm();
      const btn = document.querySelector(`.landing__realm[data-realm="${realm}"]`);
      const face = btn?.querySelector('.landing__face');
      if (face) {
        try { await runWave(realm, 'face', face, btn, gen); } catch { /* skip */ }
      }
      if (gen !== waveGen) return;
      tick(2400 + Math.random() * 2600);
    }, delay);
  };
  tick(1400);
}

function startLandWaves() {
  haltWaves();
  armLandWaves();
}

function armShrineWaves(realm) {
  const gen = waveGen;
  const tick = (delay) => {
    window.clearTimeout(waveTimer);
    waveTimer = window.setTimeout(async () => {
      if (gen !== waveGen) return;
      const hero = document.querySelector('.shrine__hero');
      if (!hero || document.body.dataset.realm !== realm) return;
      const shownAt = Number(hero.dataset.summonAt || 0);
      const summoning = hero.classList.contains('summon')
        && (!hero.classList.contains('is-shown') || performance.now() - shownAt < 760);
      if (summoning) {
        tick(280);
        return;
      }
      try { await runWave(realm, 'hero', hero, hero, gen); } catch { /* try later */ }
      if (gen !== waveGen) return;
      tick(11000 + Math.random() * 9000);
    }, delay);
  };
  tick(3800 + Math.random() * 2200);
}

function hideLandTalk() {
  document.querySelectorAll('.landing__realm.is-talking').forEach((n) => n.classList.remove('is-talking'));
  if (!dom.landingTalk) return;
  dom.landingTalk.hidden = true;
}

function landTalk(realm, hold = 4800) {
  const facts = LANDING_FACTS[realm];
  if (!facts?.length || !dom.landingBubble || !dom.landingTalk) return;
  const fact = facts[talkCursor[realm] % facts.length];
  talkCursor[realm] += 1;
  document.querySelectorAll('.landing__realm.is-talking').forEach((n) => n.classList.remove('is-talking'));
  document.querySelector(`.landing__realm[data-realm="${realm}"]`)?.classList.add('is-talking');
  const slot = (REALM_ORDER.indexOf(realm) + 0.5) / REALM_ORDER.length * 100;
  dom.landingBubble.dataset.realm = realm;
  dom.landingBubble.style.setProperty('--tail', `${slot}%`);
  if (dom.landingBubbleWho) dom.landingBubbleWho.textContent = fact.who;
  if (dom.landingBubbleText) dom.landingBubbleText.textContent = fact.text;
  dom.landingTalk.hidden = false;
  dom.landingBubble.classList.remove('is-fresh');
  void dom.landingBubble.offsetWidth;
  dom.landingBubble.classList.add('is-fresh');
  window.clearTimeout(talkHide);
  talkHide = window.setTimeout(hideLandTalk, hold);
}

function startLandTalk() {
  stopLandTalk();
  talkDelay = window.setTimeout(() => {
    if (dom.threshold?.classList.contains('is-open')) landTalk('water');
    talkPulse = window.setInterval(() => {
      if (!dom.threshold?.classList.contains('is-open')) return;
      if (dom.landingHowto && !dom.landingHowto.hidden) return;
      const realm = REALM_ORDER[Math.floor(Math.random() * REALM_ORDER.length)];
      landTalk(realm);
    }, 7000);
  }, 1400);
}

function stopLandTalk() {
  window.clearTimeout(talkDelay);
  window.clearInterval(talkPulse);
  window.clearTimeout(talkHide);
  hideLandTalk();
}

function showThreshold() {
  const tp = Store.touchByType('threshold')[0];
  const park = Store.state.park || {};
  if (dom.landingPlace) {
    dom.landingPlace.textContent = park.locationName || park.name || 'Ice Castles';
  }
  if (dom.landingProgress) {
    dom.landingProgress.textContent = `${Store.realmsAwakened()} / 5 Realms Awakened`;
  }
  if (dom.landingHowtoBody) {
    const story = tp?.body || park.welcomeBody ||
      'Explore the castle, complete five Guardian challenges in any order, then scan The Heart.';
    const discover = tp?.discoverBody ||
      'Guardians can be done in any order. The Heart finishes the quest.';
    dom.landingHowtoBody.textContent = `${story} ${discover}`;
  }
  hideLandingHowto();
  document.body.classList.add('landing-open');
  dom.threshold.hidden = false;
  dom.threshold.inert = false;
  dom.threshold.classList.add('is-open');
  startLandTalk();
  startLandWaves();
}

function hideLandingHowto() {
  if (!dom.landingHowto) return;
  dom.landingHowto.hidden = true;
}

function hideThreshold() {
  stopLandTalk();
  haltWaves();
  hideLandingHowto();
  document.body.classList.remove('landing-open');
  dom.threshold.classList.remove('is-open');
  dom.threshold.inert = true;
  setTimeout(() => { dom.threshold.hidden = true; }, 320);
}

async function enterFromLanding({ journeyMode }) {
  stripWelcomePreview();
  await Store.startSession(Store.intendedStation());
  Store.setIntendedStation(null);
  goVenueHome();
  hideThreshold();
  renderProgress();
  Store.setJourneyMode(journeyMode);
  openMapHome({ fit: journeyMode ? 'guardians' : 'park' });
}

function hideMapModal() {
  if (!dom.mapModal) return;
  mapModalMode = null;
  mapModalStation = null;
  dom.mapModal.classList.remove('is-open', 'mapModal--hint');
  dom.mapModal.inert = true;
  document.body.classList.remove('map-modal-open');
  setTimeout(() => {
    if (!dom.mapModal.classList.contains('is-open')) dom.mapModal.hidden = true;
  }, 280);
}

function showMapModal({ mode, eyebrow, title, body, primary, ghost, placement }) {
  mapModalMode = mode;
  dom.mapModalEyebrow.textContent = eyebrow;
  dom.mapModalTitle.textContent = title;
  dom.mapModalBody.textContent = body;
  dom.mapModalPrimary.textContent = primary;
  dom.mapModalGhost.textContent = ghost || '';
  dom.mapModalGhost.hidden = !ghost;
  dom.mapModal.hidden = false;
  dom.mapModal.inert = false;
  dom.mapModal.classList.toggle('mapModal--hint', placement === 'hint');
  document.body.classList.add('map-modal-open');
  dom.mapModal.classList.add('is-open');
}

function showChoiceModal() {
  showMapModal({
    mode: 'choice',
    eyebrow: 'Castle Quest',
    title: 'Where to first?',
    body: 'Wander the whole castle, or begin the quest and pick a Guardian challenge.',
    primary: 'Begin the quest',
    ghost: 'Explore the map',
  });
}

function showBeginStationModal(station) {
  mapModalStation = station;
  showMapModal({
    mode: 'begin',
    eyebrow: station.subtitle || 'Guardian',
    title: station.title,
    body: 'Begin this shrine when you are ready.',
    primary: `Begin ${station.title}`,
    ghost: 'Stay on the map',
  });
}

function showBeginGuide() {
  showMapModal({
    mode: 'beginGuide',
    placement: 'hint',
    eyebrow: 'Begin Quest',
    title: 'Pick a Guardian',
    body: 'These glowing seals are the five Guardians. Walk to any one, then tap its seal to meet them and play their challenge.',
    primary: 'Got it',
  });
}

function frameGuardians(attempt = 0) {
  const ids = Store.guardianPoiIds();
  const points = Store.state.pois.filter((poi) => ids.has(poi.id));
  ParkMap.invalidate?.();
  const size = ParkMap.getMap?.()?.getSize?.();
  if ((!size || size.y < 40) && attempt < 6) {
    setTimeout(() => frameGuardians(attempt + 1), 50);
    return;
  }
  const card = document.querySelector('.mapModal.is-open .mapModal__card');
  const insetBottom = card ? Math.ceil(card.getBoundingClientRect().height) + 28 : 0;
  ParkMap.fitToPoints(points, { insetBottom });
}

function applyMapMode(on) {
  Store.setJourneyMode(on);
  renderMap();
  setTimeout(() => ParkMap.fit(), 80);
}

function handleMapModalPrimary() {
  if (mapModalMode === 'choice') {
    hideMapModal();
    applyMapMode(true);
    return;
  }
  if (mapModalMode === 'begin' && mapModalStation) {
    const slug = mapModalStation.slug;
    hideMapModal();
    goStation(slug);
    return;
  }
  if (mapModalMode === 'beginGuide') hideMapModal();
}

function handleMapModalGhost() {
  if (mapModalMode === 'choice') {
    hideMapModal();
    applyMapMode(false);
    return;
  }
  hideMapModal();
}

function openMapHome({ showChoice = false, fit = 'park' } = {}) {
  hideThreshold();
  if (!showChoice) hideMapModal();
  document.body.classList.toggle('begin-frame', fit === 'guardians');
  const welcome = Store.touchByType('threshold')[0];
  renderStation(welcome?.slug || 'threshold');
  openGuide();
  setTimeout(() => {
    ParkMap.invalidate?.();
    if (fit === 'guardians') frameGuardians();
    else ParkMap.fit();
  }, 80);
  if (showChoice) showChoiceModal();
  if (fit === 'guardians') {
    setTimeout(() => {
      if (!document.body.classList.contains('guide-open')) return;
      showBeginGuide();
      frameGuardians();
    }, 420);
  }
}

function showGuardianQrLanding(station) {
  hideThreshold();
  const welcome = Store.touchByType('threshold')[0];
  renderStation(welcome?.slug || 'threshold');
  openGuide();
  document.body.classList.remove('sheet-open');
  showBeginStationModal(station);
  setTimeout(() => {
    ParkMap.invalidate?.();
    if (station.poiId) ParkMap.focusOn(station.poiId, Store.state.pois, { zoom: 0.5, offsetY: 0.2 });
  }, 120);
}

function openGuide() {
  document.body.classList.add('guide-open');
  dom.guide.hidden = false;
  dom.guideToggle.setAttribute('aria-pressed', 'true');
  dom.guideToggle.textContent = 'Quest';
  dom.guideToggle.setAttribute('aria-label', 'Back to Castle Quest');
  if (dom.headerMap) dom.headerMap.setAttribute('aria-pressed', 'true');
  ensureMap();
  setTimeout(() => ParkMap.invalidate?.(), 80);
}

function closeGuide({ force = false } = {}) {
  if (!force && mapModalMode === 'choice') return;
  if (force || mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
  document.body.classList.remove('guide-open');
  document.body.classList.remove('sheet-open');
  dom.guide.hidden = true;
  dom.guideToggle.setAttribute('aria-pressed', 'false');
  dom.guideToggle.textContent = 'Quest';
  dom.guideToggle.setAttribute('aria-label', 'Back to Castle Quest');
  if (dom.headerMap) dom.headerMap.setAttribute('aria-pressed', 'false');
}

function ensureMap() {
  if (mapReady) {
    renderMap();
    return;
  }
  ParkMap.init(document.getElementById('map'), Store.state.map, {
    onSelect: (poiId) => {
      if (!poiId) {
        document.body.classList.remove('sheet-open');
        return;
      }
      const touch = Store.touchForPoi(poiId);
      if (Store.state.journeyMode && touch?.type === 'guardian') {
        document.body.classList.remove('sheet-open');
        goStation(touch.slug);
        return;
      }
      const poi = Store.poiById(poiId);
      if (poi) openPoiSheet(poi);
    },
  });
  mapReady = true;
  renderMap();
  renderLegend();
}

function renderMap() {
  if (!mapReady) return;
  const guardians = Store.guardianPoiIds();
  const completed = Store.completedGuardianPoiIds();
  const glowing = new Set([...guardians].filter((id) => !completed.has(id)));
  const realmByPoi = {};
  (Store.state.touchpoints || []).forEach((tp) => {
    if (tp.poiId && tp.element) realmByPoi[tp.poiId] = tp.element;
  });
  ParkMap.render(Store.state.pois, {
    scanned: Store.scannedIds(),
    targets: Store.state.journeyMode ? guardians : Store.journeyPoiIds(),
    hidden: Store.state.hiddenCategories,
    journeyOnly: Store.state.journeyMode,
    journeyIds: guardians,
    completed: Store.state.journeyMode ? completed : new Set(),
    glowing: Store.state.journeyMode ? glowing : new Set(),
    realmByPoi,
  });
  if (dom.journeyButton) {
    dom.journeyButton.setAttribute('aria-pressed', Store.state.journeyMode ? 'true' : 'false');
  }
}

function openPoiSheet(poi) {
  const touch = Store.touchForPoi(poi.id);
  dom.sheetBody.innerHTML = `
    <div>
      <p class="poi__eyebrow">${escapeHtml(poi.category)}</p>
      <h2 class="poi__name">${escapeHtml(poi.name)}</h2>
      ${poi.blurb ? `<p class="poi__blurb">${escapeHtml(poi.blurb)}</p>` : ''}
      ${poi.description ? `<p class="poi__body">${escapeHtml(poi.description)}</p>` : ''}
      ${touch ? `<button class="textButton" data-go-station="${escapeHtml(touch.slug)}" type="button">Open ${escapeHtml(touch.title)}</button>` : ''}
    </div>`;
  document.body.classList.add('sheet-open');
}

function renderLegend() {
  const counts = {};
  Store.state.pois.forEach((poi) => {
    counts[poi.category] = (counts[poi.category] || 0) + 1;
  });
  dom.legendRows.innerHTML = Object.entries(counts).map(([category, count]) => {
    const on = !Store.state.hiddenCategories.has(category);
    return `<button class="legend__row" data-category="${escapeHtml(category)}" aria-pressed="${on}" type="button">
      <span>${escapeHtml(category)}</span><span class="legend__count">${count}</span>
    </button>`;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* awards                                                                     */
/* -------------------------------------------------------------------------- */

function enqueueAward(award) {
  awardQueue.push(award);
  if (!awardShowing) showNextAward();
}

function showNextAward() {
  const next = awardQueue.shift();
  if (!next) { awardShowing = false; return; }
  awardShowing = true;
  document.body.classList.add('award-open');
  dom.award.classList.toggle('is-final', Boolean(next.final));
  if (next.glyphUrl) {
    dom.awardGlyph.innerHTML = `<img src="${escapeHtml(next.glyphUrl)}" alt="">`;
  } else {
    dom.awardGlyph.textContent = next.glyph || '';
  }
  dom.awardKicker.textContent = next.kicker;
  dom.awardTitle.textContent = next.title;
  dom.awardMeta.textContent = next.meta;
  dom.awardDone.textContent = next.action || 'Keep exploring';
  const awakened = Store.realmsAwakened();
  dom.awardPips.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<span class="award__pip ${i < awakened ? 'is-on' : ''}"></span>`).join('');
  dom.award.hidden = false;
  requestAnimationFrame(() => dom.award.classList.add('is-open'));
  if (navigator.vibrate) navigator.vibrate(45);
}

function dismissAward() {
  dom.award.classList.remove('is-open');
  document.body.classList.remove('award-open');
  setTimeout(() => { dom.award.hidden = true; showNextAward(); }, 340);
}

async function handleStationChallenge(slug, answer) {
  const result = await Store.completeStation(slug, answer);
  if (result.status === 'error') {
    const messages = {
      bad_code: 'That word isn’t right. Try again.',
      bad_images: 'Not those three — look again at the ice.',
      bad_sequence: 'Not that order. Watch once more.',
    };
    toast(messages[result.error] || 'Not quite — try again.');
    return;
  }
  renderProgress();
  renderStation(slug);
  renderMap();
  if (result.realmAwakened) {
    const meta = REALM_META[result.realmAwakened] || { label: result.realmAwakened, glyph: '✦' };
    enqueueAward({
      glyph: meta.glyph,
      glyphUrl: realmIcon(result.realmAwakened, true),
      kicker: 'Realm Awakened',
      title: meta.label,
      meta: `${Store.realmsAwakened()} of 5 Realms`,
    });
  } else if (result.status === 'repeat') {
    toast('Already recorded.');
  } else {
    toast('Saved.', { warm: true });
  }
}

async function handleCode(code) {
  const result = await Store.scan(code);
  Scanner.close();
  if (result.status === 'unknown') return toast('That code isn’t one of ours.');
  if (result.status === 'invalid') return toast('Enter the printed code.');
  if (result.status === 'queued') return toast('Saved until you have signal.', { warm: true });
  if (result.poi) {
    ensureMap();
    openGuide();
    openPoiSheet(result.poi);
    const touch = Store.touchForPoi(result.poi.id);
    if (touch) toast(`${result.poi.name} — open the quest station if you like.`);
  }
}

/* -------------------------------------------------------------------------- */
/* routing                                                                    */
/* -------------------------------------------------------------------------- */

async function route() {
  Store.state.path = Store.pathContext();
  const slug = Store.state.path.station;
  const live = Store.hasLiveSession();

  if (!live || wantsWelcomePreview()) {
    if (!live && slug && slug !== 'threshold') Store.setIntendedStation(slug);
    hideMapModal();
    showThreshold();
    const welcome = Store.touchByType('threshold')[0];
    renderStation(welcome?.slug || 'threshold');
    return;
  }

  hideThreshold();

  if (!slug || slug === 'threshold') {
    Store.setIntendedStation(null);
    openMapHome();
    return;
  }

  const station = Store.touchBySlug(slug);
  if (station?.type === 'guardian' && !station.complete) {
    showGuardianQrLanding(station);
    return;
  }

  await openStation(slug);
}

/* -------------------------------------------------------------------------- */
/* wiring                                                                     */
/* -------------------------------------------------------------------------- */

function bindFunButtons() {
  const skip = (btn) =>
    !btn || btn.disabled || btn.closest('.leaflet-container') || btn.classList.contains('landing__realm');

  const spark = (btn, event) => {
    if (btn.classList.contains('sheet__grip')) return;
    const pos = window.getComputedStyle(btn).position;
    if (pos === 'static') btn.classList.add('is-fun');
    const rect = btn.getBoundingClientRect();
    const x = (event.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (event.clientY || rect.top + rect.height / 2) - rect.top;
    const burst = document.createElement('span');
    burst.className = 'btnBurst';
    burst.setAttribute('aria-hidden', 'true');
    burst.style.setProperty('--x', `${x}px`);
    burst.style.setProperty('--y', `${y}px`);
    burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
    btn.appendChild(burst);
    window.setTimeout(() => burst.remove(), 560);
  };

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const btn = event.target.closest('button');
    if (skip(btn)) return;
    btn.classList.add('is-pressed');
    spark(btn, event);
  });

  const release = () => {
    document.querySelectorAll('button.is-pressed').forEach((btn) => {
      btn.classList.remove('is-pressed');
      btn.classList.remove('is-pop');
      void btn.offsetWidth;
      btn.classList.add('is-pop');
    });
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('animationend', (event) => {
    if (event.animationName === 'btnPop') event.target.classList.remove('is-pop');
  });
}

function paintSequence(root) {
  if (!root) return;
  const slots = root.querySelectorAll('[data-seq-slot]');
  if (slots.length) {
    const buttons = [...root.querySelectorAll('[data-seq]')];
    slots.forEach((slot, index) => {
      const id = sequenceBuffer[index];
      slot.classList.toggle('is-filled', Boolean(id));
      slot.replaceChildren();
      if (!id) {
        const dot = document.createElement('span');
        dot.className = 'seqSlot__dot';
        slot.appendChild(dot);
        return;
      }
      const source = buttons.find((btn) => btn.dataset.seq === id)?.querySelector('img');
      if (source) {
        const img = source.cloneNode(true);
        img.alt = '';
        slot.appendChild(img);
        return;
      }
      const mark = document.createElement('span');
      mark.className = 'seqSlot__dot';
      slot.appendChild(mark);
    });
    return;
  }
  const readout = root.querySelector('[data-seq-readout]');
  if (!readout) return;
  readout.textContent = sequenceBuffer.length
    ? sequenceBuffer.map((id) => REALM_META[id]?.label || id).join(' → ')
    : 'Tap the sequence';
}

function wire() {
  bindFunButtons();
  dom.progressButton.addEventListener('click', () => openPanel('journey'));
  const toggleGuide = () => {
    if (mapModalMode === 'choice') return;
    if (document.body.classList.contains('guide-open')) closeGuide();
    else openGuide();
  };
  dom.guideToggle.addEventListener('click', toggleGuide);
  if (dom.headerMap) dom.headerMap.addEventListener('click', toggleGuide);

  dom.thresholdStart.addEventListener('click', () => enterFromLanding({ journeyMode: true }));
  dom.landingMap?.addEventListener('click', () => enterFromLanding({ journeyMode: false }));
  dom.landingHow?.addEventListener('click', () => {
    hideLandTalk();
    if (dom.landingHowto) dom.landingHowto.hidden = false;
  });
  dom.landingHowtoClose?.addEventListener('click', hideLandingHowto);
  dom.landingRealms?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-realm]');
    if (!btn) return;
    landTalk(btn.dataset.realm);
  });
  dom.landingRealms?.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    const btn = event.target.closest('[data-realm]');
    if (!btn || btn.classList.contains('is-talking')) return;
    landTalk(btn.dataset.realm);
  }, true);

  dom.mapModalPrimary.addEventListener('click', handleMapModalPrimary);
  dom.mapModalGhost.addEventListener('click', handleMapModalGhost);
  dom.mapModal.addEventListener('click', (event) => {
    if (event.target !== dom.mapModal) return;
    if (mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
  });

  dom.sheetGrip.addEventListener('click', () => document.body.classList.remove('sheet-open'));
  dom.recenter.addEventListener('click', () => {
    const framed = document.body.classList.contains('begin-frame');
    document.body.classList.remove('begin-frame');
    const refit = () => {
      ParkMap.invalidate?.();
      ParkMap.fit();
      toast('Whole park in view');
    };
    if (framed) setTimeout(refit, 40);
    else refit();
  });
  dom.journeyButton.addEventListener('click', () => {
    const on = Store.toggleJourneyMode();
    renderMap();
    toast(on ? 'Guardian stops only' : 'Full park map');
  });
  dom.filterButton.addEventListener('click', () => {
    const showing = !dom.legend.hidden;
    dom.legend.hidden = showing;
    if (!showing) renderLegend();
  });
  dom.legendRows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    Store.toggleCategory(button.dataset.category);
    renderLegend();
    renderMap();
  });
  dom.scanFab.addEventListener('click', () => Scanner.open(handleCode));
  dom.awardDone.addEventListener('click', dismissAward);
  document.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', closePanels);
  });

  document.addEventListener('click', (event) => {
    const listen = event.target.closest('[data-listen]');
    if (listen) {
      playStory(listen);
      return;
    }
    const shrineBtn = event.target.closest('[data-shrine-focus]');
    if (shrineBtn) {
      setShrineFocus(shrineBtn.dataset.shrineFocus);
      return;
    }
    const go = event.target.closest('[data-go-station]');
    if (go) {
      closePanels();
      closeGuide();
      goStation(go.dataset.goStation);
      return;
    }
    if (event.target.closest('[data-open-journey]')) { openPanel('journey'); return; }
    if (event.target.closest('[data-show-reward]')) { showReward(); return; }
    if (event.target.closest('[data-close-finale]')) { hideFinale(); return; }

    const image = event.target.closest('[data-image-id]');
    if (image) {
      const id = image.dataset.imageId;
      if (selectedImages.has(id)) selectedImages.delete(id);
      else {
        if (selectedImages.size >= 3) selectedImages.clear();
        selectedImages.add(id);
      }
      image.closest('.pickGrid').querySelectorAll('[data-image-id]').forEach((btn) => {
        btn.classList.toggle('is-on', selectedImages.has(btn.dataset.imageId));
      });
      return;
    }
    if (event.target.closest('[data-image-submit]')) {
      const root = event.target.closest('[data-station]');
      handleStationChallenge(root.dataset.station, { ids: [...selectedImages] });
      return;
    }
    const seq = event.target.closest('[data-seq]');
    if (seq) {
      const root = seq.closest('[data-station]');
      const len = Number(root.dataset.seqLen || 5);
      if (sequenceBuffer.length >= len) return;
      sequenceBuffer.push(seq.dataset.seq);
      paintSequence(root);
      if (!root.querySelector('[data-seq-submit]') && sequenceBuffer.length >= len) {
        const answer = { sequence: [...sequenceBuffer] };
        sequenceBuffer = [];
        handleStationChallenge(root.dataset.station, answer);
      }
      return;
    }
    if (event.target.closest('[data-seq-clear]')) {
      sequenceBuffer = [];
      paintSequence(event.target.closest('[data-station]'));
      return;
    }
    if (event.target.closest('[data-seq-submit]')) {
      const root = event.target.closest('[data-station]');
      const len = Number(root.dataset.seqLen || 5);
      if (sequenceBuffer.length < len) {
        toast('Tap the full sequence first.');
        return;
      }
      const answer = { sequence: [...sequenceBuffer] };
      sequenceBuffer = [];
      paintSequence(root);
      handleStationChallenge(root.dataset.station, answer);
      return;
    }
    if (event.target.closest('[data-challenge-submit]')) {
      const root = event.target.closest('[data-station]');
      const code = root.querySelector('[data-challenge-code]')?.value;
      handleStationChallenge(root.dataset.station, { code });
      return;
    }
    if (event.target.closest('[data-quiz-submit]')) {
      const root = event.target.closest('[data-station]');
      handleStationChallenge(root.dataset.station, { done: true });
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'keepersForm') return;
    event.preventDefault();
    submitKeepers(event.target);
  });

  window.addEventListener('popstate', route);
  window.addEventListener('pagehide', stopStoryAudio);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (Scanner.isOpen()) Scanner.close();
    else if (!dom.award.hidden) dismissAward();
    else if (!dom.finale.hidden) hideFinale();
    else if (mapModalMode === 'choice') return;
    else if (mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
    else if (currentPanel) closePanels();
    else if (document.body.classList.contains('guide-open')) closeGuide();
  });
}

async function boot() {
  wire();
  try {
    await Store.load();
  } catch {
    dom.splash.innerHTML = `<div class="empty"><h3 class="empty__title">Can’t reach Castle Quest</h3><p class="empty__body">Check your connection and reload.</p></div>`;
    return;
  }

  const park = Store.state.park || {};
  const adventure = Store.state.adventure || {};
  dom.parkName.textContent = 'Castle Quest';
  dom.parkLocation.textContent = park.locationName || park.name || '';
  document.title = `Castle Quest — ${park.name || 'Ice Castles'}`;
  if (adventure.venueCode && !Store.state.path.venueCode) {
    history.replaceState(null, '', `${Store.stationPath(Store.state.path.station)}${location.search}`);
    Store.state.path = Store.pathContext();
  }

  renderProgress();
  await route();

  if (Store.state.session?.winterKeeper && Store.state.path.station === 'heart') {
    showFinale();
  }

  dom.splash.classList.add('is-gone');
  setTimeout(() => { dom.splash.hidden = true; }, 520);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

boot();
