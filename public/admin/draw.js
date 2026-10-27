/* global window, document, fetch, requestAnimationFrame */

/**
 * Park drawing. One document per location. The drone photo is a tracing
 * guide and is left out of the picture guests download.
 */
const ParkDraw = (() => {
  const STAMPS = [
    ['turret', 'Turret'],
    ['tower', 'Spire'],
    ['tower2', 'Spire 2'],
    ['fir1', 'Fir'],
    ['fir2', 'Fir 2'],
    ['fir3', 'Small'],
    ['hut', 'Hut'],
    ['lamp', 'Lamp'],
    ['wall', 'Wall'],
  ];
  const STAMP_LABEL = Object.fromEntries(STAMPS);
  STAMP_LABEL.keep = 'Castle';
  const STYLE_LABEL = { ground: 'Snow ground', snow: 'Snow path', boardwalk: 'Boardwalk', bridge: 'Bridge', wall: 'Castle wall' };
  const STAMP_R = { fir1: 44, fir2: 38, fir3: 26, hut: 50, lamp: 39, tower: 55, tower2: 55, turret: 48, keep: 110, wall: 55 };
  const PATH_WIDTH = 6;
  const WALL_WIDTH = 11;
  const ISLAND_CURVES = [
    { c: [520, 140], e: [820, 170] },
    { c: [1030, 192], e: [1220, 156] },
    { c: [1470, 110], e: [1620, 246] },
    { c: [1770, 374], e: [1716, 576] },
    { c: [1664, 772], e: [1476, 876] },
    { c: [1286, 980], e: [1006, 998] },
    { c: [706, 1018], e: [446, 964] },
    { c: [186, 910], e: [110, 734] },
    { c: [34, 558], e: [134, 404] },
    { c: [228, 258], e: [300, 250] },
  ];

  const DEFS = `
    <linearGradient id="sky" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#071528"/><stop offset="1" stop-color="#040d1b"/>
    </linearGradient>
    <linearGradient id="snow" x1="0.1" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#4a749f"/><stop offset="0.5" stop-color="#3a6089"/><stop offset="1" stop-color="#2b4b6e"/>
    </linearGradient>
    <linearGradient id="trail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f2ddb4"/><stop offset="1" stop-color="#d9be8d"/>
    </linearGradient>
    <linearGradient id="iceFace" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#eaf9ff"/><stop offset="1" stop-color="#9fd8f2"/>
    </linearGradient>
    <linearGradient id="iceSide" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#8ec9e8"/><stop offset="1" stop-color="#5b9ec4"/>
    </linearGradient>
    <radialGradient id="lampGlow"><stop offset="0" stop-color="#ffc978" stop-opacity=".55"/><stop offset="1" stop-color="#ffc978" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
    <g id="fir1">${stampImage('fir1', 71.6, 88)}</g>
    <g id="fir2">${stampImage('fir2', 74.3, 72)}</g>
    <g id="fir3">${stampImage('fir3', 41.4, 52)}</g>
    <g id="hut">${stampImage('hut', 100, 97.9)}</g>
    <g id="lamp">${stampImage('lamp', 62.2, 78)}</g>
    <g id="tower">${stampImage('tower', 62.8, 110)}</g>
    <g id="tower2">${stampImage('tower2', 51.9, 110)}</g>
    <g id="turret">${stampImage('turret', 96, 83.3)}</g>
    <g id="keep">
      <ellipse cx="0" cy="48" rx="84" ry="14" fill="#071422" opacity=".25"/>
      <use href="#tower" xlink:href="#tower" transform="translate(0 -16) scale(0.82)"/>
      <path d="M-62 18 L64 10 L60 36 L-58 42 Z" fill="url(#iceSide)" stroke="#2f6f95" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M-66 6 L68 -2 L64 18 L-62 24 Z" fill="url(#iceFace)" stroke="#2f6f95" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M-60 26 L62 18" fill="none" stroke="#eaf9ff" stroke-width="1.1" opacity=".4"/>
      <use href="#tower" xlink:href="#tower" transform="translate(-52 14) scale(0.46)"/>
      <use href="#tower" xlink:href="#tower" transform="translate(56 16) scale(0.4)"/>
    </g>
    <g id="wall">${stampImage('wall', 110, 68.9)}</g>
  `;

  const HINTS = {
    pan: 'Drag to move around. Scroll to zoom.',
    select: 'Click a path or stamp, then drag it. Delete removes it.',
    points: 'Drag a point to move it. Click a point, then Delete to remove it. Drag the line to move the whole path.',
    wallOpen: 'Drag a point to move it. Click a point, then Delete to remove it. Click the wall again to open or close a tunnel.',
    path: 'Click to add points. Double-click or Finish path when the line is done.',
    ground: 'Click around the snow. Double-click to close the shape. Opacity fades this base layer.',
    wall: 'Click along the wall. The pale band is the top of the ice, and the blue face hangs toward the bottom of the map. Double-click to finish.',
    stamp: 'Click the map to place the chosen stamp. Drag it with Select.',
    reference: 'Drag the photo until it lines up, then lock it. Publish leaves it out.',
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const r1 = (value) => Math.round(num(value) * 10) / 10;

  let deps = null;
  let doc = null;
  let currentId = null;
  let blobUrl = null;
  let tool = 'pan';
  let stampKind = 'turret';
  let selectedId = null;
  let vertexIndex = null;
  let draft = [];
  let undo = [];
  let pointer = null;
  let view = { x: 0, y: 0, z: 0.4 };
  let rev = 0;
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let fittedFor = null;
  let syncing = false;
  let idSeq = 1;

  const stage = $('drawStage');
  const viewport = $('drawViewport');
  const svg = $('drawSvg');

  function nextId() {
    idSeq += 1;
    return `f${Date.now().toString(36)}${idSeq}`;
  }

  function selectedFeature() {
    return doc?.features?.find((f) => f.id === selectedId) || null;
  }

  function snapshot() {
    if (!doc) return;
    undo.push(JSON.stringify(doc));
    if (undo.length > 40) undo.shift();
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveChain = saveChain.then(() => saveNow()).catch((err) => {
        deps?.toast?.(err.message === 'unauthorized' ? 'Sign in again.' : 'Couldn’t save the drawing.', true);
      });
    }, 400);
  }

  function flush() {
    clearTimeout(saveTimer);
    saveChain = saveChain.then(() => saveNow());
    return saveChain;
  }

  async function saveNow() {
    if (!doc || !currentId || !deps) return;
    const id = currentId;
    const sent = rev;
    const body = await deps.api(`/locations/${id}/map`, {
      method: 'PUT',
      body: JSON.stringify({ document: doc }),
    });
    if (id !== currentId || sent !== rev) return;
    doc = body.document;
    render();
    deps.flashSaved?.('Saved');
  }

  function applyView() {
    viewport.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  }

  function fit() {
    if (!doc || !stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    view.z = Math.min(rect.width / doc.width, rect.height / doc.height) * 0.94;
    view.x = (rect.width - doc.width * view.z) / 2;
    view.y = (rect.height - doc.height * view.z) / 2;
    applyView();
  }

  function toWorld(event) {
    const rect = stage.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - view.x) / view.z,
      y: (event.clientY - rect.top - view.y) / view.z,
    };
  }

  function distToSeg(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  }

  function pointInPoly(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xj = points[j].x;
      const yj = points[j].y;
      const crosses = (yi > y) !== (yj > y);
      const xCross = ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
      if (crosses && x < xCross) inside = !inside;
    }
    return inside;
  }

  function hitFeature(x, y) {
    const hitOne = (feature) => {
      if (feature.type === 'stamp') {
        const radius = (STAMP_R[feature.kind] || 30) * feature.scale;
        return Math.hypot(x - feature.x, y - feature.y) <= radius;
      }
      if (feature.type !== 'path') return false;
      if (isGround(feature)) {
        if (pointInPoly(x, y, feature.points)) return true;
        for (let p = 0; p < feature.points.length; p += 1) {
          const next = feature.points[(p + 1) % feature.points.length];
          if (distToSeg(x, y, feature.points[p], next) <= 14) return true;
        }
        return false;
      }
      const pad = feature.style === 'wall' ? Math.max(12, feature.width * 0.65) : 8;
      const limit = feature.width / 2 + pad;
      for (let p = 1; p < feature.points.length; p += 1) {
        if (distToSeg(x, y, feature.points[p - 1], feature.points[p]) <= limit) return true;
      }
      return false;
    };
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = doc.features.length - 1; i >= 0; i -= 1) {
        const feature = doc.features[i];
        if (isGround(feature) !== (pass === 1)) continue;
        if (hitOne(feature)) return feature;
      }
    }
    return null;
  }

  function pathD(points) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`).join(' ');
  }

  function polyLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return total;
  }

  function pointAlong(points, dist) {
    let remain = Math.max(0, dist);
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (seg < 0.001) continue;
      if (remain <= seg) {
        const tx = (b.x - a.x) / seg;
        const ty = (b.y - a.y) / seg;
        const t = remain / seg;
        return {
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          tx,
          ty,
          nx: -ty,
          ny: tx,
          d: dist,
        };
      }
      remain -= seg;
    }
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    const seg = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const tx = (b.x - a.x) / seg;
    const ty = (b.y - a.y) / seg;
    return { x: b.x, y: b.y, tx, ty, nx: -ty, ny: tx, d: dist };
  }

  function roundCorners(points, radius) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
      const cut = Math.min(radius, inLen * 0.46, outLen * 0.46);
      if (cut < 6 || inLen < 1 || outLen < 1) {
        out.push(curr);
        continue;
      }
      const inX = (curr.x - prev.x) / inLen;
      const inY = (curr.y - prev.y) / inLen;
      const outX = (next.x - curr.x) / outLen;
      const outY = (next.y - curr.y) / outLen;
      const start = { x: curr.x - inX * cut, y: curr.y - inY * cut };
      const end = { x: curr.x + outX * cut, y: curr.y + outY * cut };
      const steps = 7;
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const u = 1 - t;
        out.push({
          x: u * u * start.x + 2 * u * t * curr.x + t * t * end.x,
          y: u * u * start.y + 2 * u * t * curr.y + t * t * end.y,
        });
      }
    }
    out.push(points[points.length - 1]);
    return out;
  }

  function roundCap(from, to, outward, radius) {
    const len = Math.hypot(outward.x, outward.y) || 1;
    const ox = outward.x / len;
    const oy = outward.y / len;
    const pts = [];
    const steps = 5;
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const bulge = Math.sin(Math.PI * t) * radius;
      pts.push({
        x: from.x + (to.x - from.x) * t + ox * bulge,
        y: from.y + (to.y - from.y) * t + oy * bulge,
      });
    }
    return pts;
  }

  function ringPath(parts) {
    const pts = parts.flat();
    if (pts.length < 3) return '';
    return `${pathD(pts)} Z`;
  }

  function ribbonPath(railA, railB, outwardStart, outwardEnd) {
    const chord = Math.hypot(railA[0].x - railB[0].x, railA[0].y - railB[0].y);
    const capR = chord * 0.34;
    const endCap = roundCap(railA[railA.length - 1], railB[railB.length - 1], outwardEnd, capR);
    const startCap = roundCap(railB[0], railA[0], outwardStart, capR);
    return ringPath([railA, endCap, [...railB].reverse(), startCap]);
  }

  function closestAlong(points, x, y) {
    let best = null;
    let walked = 0;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy || 1;
      const seg = Math.sqrt(len2);
      let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const dist = Math.hypot(x - px, y - py);
      if (!best || dist < best.dist) best = { d: walked + seg * t, dist };
      walked += seg;
    }
    return best;
  }

  function tunnelMetrics(thick) {
    const faceH = Math.max(3, thick * 0.58);
    const mouthW = Math.max(thick * 2.4, 9);
    return { faceH, mouthW, span: mouthW * 0.55 };
  }

  function tunnelArch(cx, cy, ox, oy, radius) {
    const tx = oy;
    const ty = -ox;
    const x0 = cx - tx * radius;
    const y0 = cy - ty * radius;
    const x1 = cx + tx * radius;
    const y1 = cy + ty * radius;
    const r = r1(radius);
    const dome = `M${r1(x0)} ${r1(y0)} A${r} ${r} 0 0 1 ${r1(x1)} ${r1(y1)}`;
    return { dome, shape: `${dome} Z` };
  }

  function wallMarkup(feature) {
    const thick = Math.max(feature.width, 4);
    const rounded = roundCorners(feature.points, Math.max(8, thick * 0.65));
    const total = polyLength(rounded);
    if (total < 6 || rounded.length < 2) return '';
    const step = Math.max(4, Math.min(9, thick * 0.16));
    const raw = [];
    for (let d = 0; d <= total; d += step) raw.push(pointAlong(rounded, Math.min(d, total)));
    if (raw[raw.length - 1].d < total - 0.4) raw.push(pointAlong(rounded, total));
    const samples = raw.map((sample, index) => {
      const prev = raw[Math.max(0, index - 1)];
      const next = raw[Math.min(raw.length - 1, index + 1)];
      let nx = prev.nx + sample.nx + next.nx;
      let ny = prev.ny + sample.ny + next.ny;
      const mag = Math.hypot(nx, ny) || 1;
      nx /= mag;
      ny /= mag;
      return { ...sample, nx, ny };
    });

    const half = thick * 0.5;
    const { faceH, mouthW, span } = tunnelMetrics(thick);
    const left = samples.map((s) => ({ x: s.x + s.nx * half, y: s.y + s.ny * half }));
    const right = samples.map((s) => ({ x: s.x - s.nx * half, y: s.y - s.ny * half }));
    const rawLen = polyLength(feature.points) || 1;
    const tunnelPts = (feature.tunnels || []).map((dist, index) => ({
      at: pointAlong(rounded, (dist / rawLen) * total),
      dist: (dist / rawLen) * total,
      index,
    }));
    const sunkLeft = left.map((point) => ({ x: point.x, y: point.y + faceH }));
    const sunkRight = right.map((point) => ({ x: point.x, y: point.y + faceH }));
    const start = samples[0];
    const end = samples[samples.length - 1];
    const capStart = { x: -start.tx, y: -start.ty };
    const capEnd = { x: end.tx, y: end.ty };
    const snow = ribbonPath(left, right, capStart, capEnd);
    const ice = ribbonPath(sunkLeft, sunkRight, capStart, capEnd);
    const arches = tunnelPts.map((tunnel) => {
      let best = 0;
      for (let i = 1; i < samples.length; i += 1) {
        if (Math.abs(samples[i].d - tunnel.dist) < Math.abs(samples[best].d - tunnel.dist)) best = i;
      }
      const sample = samples[best];
      let ox = sample.nx;
      let oy = sample.ny;
      if (oy < 0) {
        ox = -ox;
        oy = -oy;
      }
      const mag = Math.hypot(ox, oy) || 1;
      ox /= mag;
      oy /= mag;
      const extra = faceH * oy;
      const radius = Math.max(half * 1.15, faceH * 0.9);
      const cx = sample.x + ox * (half + extra);
      const cy = sample.y + oy * (half + extra);
      return {
        id: `tunnel-${feature.id || 'draft'}-${tunnel.index}`,
        cx,
        cy,
        radius,
        ox,
        oy,
        ...tunnelArch(cx, cy, ox, oy, radius),
      };
    });
    const clip = `wall-${feature.id || 'draft'}`;
    const ink = '#2c241f';
    const stroke = r1(Math.max(2.2, thick * 0.1));
    const flutes = [];
    const spots = [];
    const nearest = (dist) => samples.reduce((best, sample, index) => (
      Math.abs(sample.d - dist) < Math.abs(samples[best].d - dist) ? index : best
    ), 0);
    for (let dist = thick * 0.65; dist < total - thick * 0.3; dist += Math.max(14, thick * 0.7)) {
      if (tunnelPts.some((opening) => Math.abs(opening.dist - dist) < span)) continue;
      const index = nearest(dist);
      const low = left[index].y >= right[index].y ? left[index] : right[index];
      flutes.push(`<path d="M${r1(low.x)} ${r1(low.y)} L${r1(low.x)} ${r1(low.y + faceH)}" fill="none" stroke="#e7f7ff" stroke-width="${r1(Math.max(1.5, thick * 0.12))}" stroke-linecap="round" opacity="0.75"/>`);
    }
    for (let dist = thick * 0.85; dist < total - thick * 0.2; dist += Math.max(28, thick * 1.8)) {
      const index = nearest(dist);
      const midX = (left[index].x + right[index].x) / 2;
      const midY = (left[index].y + right[index].y) / 2;
      spots.push(`<ellipse cx="${r1(midX)}" cy="${r1(midY)}" rx="${r1(thick * 0.18)}" ry="${r1(Math.max(1.3, thick * 0.07))}" fill="#d5e9f4" opacity="0.5"/>`);
    }
    const shadow = pathD(samples.map((s) => ({ x: s.x, y: s.y + faceH + half * 0.35 })));
    const hole = `${clip}-hole`;
    const holes = arches.map((arch) => `<path d="${arch.shape}" fill="black"/>`).join('');
    const mouths = arches.map((arch) => `<linearGradient id="${arch.id}" gradientUnits="userSpaceOnUse" x1="${r1(arch.cx - arch.ox * arch.radius)}" y1="${r1(arch.cy - arch.oy * arch.radius)}" x2="${r1(arch.cx)}" y2="${r1(arch.cy)}">
        <stop offset="0" stop-color="#16324c"/>
        <stop offset="1" stop-color="#3e6d8f"/>
      </linearGradient>
      <path d="${arch.shape}" fill="url(#${arch.id})"/>`).join('');
    const lips = arches.map((arch) => `<path d="${arch.dome}" fill="none" stroke="${ink}" stroke-width="${stroke}" stroke-linecap="round"/>`).join('');

    return `<g>
      <defs>
        <clipPath id="${clip}"><path d="${snow}"/><path d="${ice}"/></clipPath>
        <mask id="${hole}" maskUnits="userSpaceOnUse">
          <rect x="-500" y="-500" width="4000" height="4000" fill="white"/>
          ${holes}
        </mask>
      </defs>
      <path d="${shadow}" fill="none" stroke="#06101c" stroke-width="${r1(thick * 0.45)}" stroke-linecap="round" opacity="0.16" filter="url(#soft)"/>
      <g mask="url(#${hole})">
        <path d="${ice}" fill="${ink}" stroke="${ink}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${snow}" fill="${ink}" stroke="${ink}" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round"/>
        <path d="${ice}" fill="#7ec4ee"/>
        <path d="${snow}" fill="#f7fbff"/>
        <g clip-path="url(#${clip})">
          ${flutes.join('')}
          ${spots.join('')}
        </g>
      </g>
      <g clip-path="url(#${clip})">${mouths}</g>
      <g clip-path="url(#${clip})">${lips}</g>
    </g>`;
  }

  function pathMarkup(feature) {
    const d = pathD(feature.points);
    const w = feature.width;
    if (feature.style === 'ground') return groundShape(feature);
    if (feature.style === 'wall') return wallMarkup(feature);
    if (feature.style === 'bridge') {
      return `<g>
        <path d="${d}" fill="none" stroke="#1c3348" stroke-width="${w + 16}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#e7d3b0" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#8d6a4f" stroke-width="2" stroke-dasharray="10 16" stroke-linecap="butt"/>
      </g>`;
    }
    if (feature.style === 'boardwalk') {
      return `<g>
        <path d="${d}" fill="none" stroke="#3a2415" stroke-width="${w + 8}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#c4a574" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="#6b4e32" stroke-width="2" stroke-dasharray="3 11"/>
      </g>`;
    }
    return `<g>
      <path d="${d}" fill="none" stroke="#3a2415" stroke-width="${w + 10}" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/>
      <path d="${d}" fill="none" stroke="url(#trail)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="14 20" stroke-linecap="round" opacity="0.45"/>
    </g>`;
  }

  function stampMarkup(feature) {
    return `<use href="#${feature.kind}" xlink:href="#${feature.kind}" transform="translate(${r1(feature.x)} ${r1(feature.y)}) rotate(${r1(feature.rotation)}) scale(${r1(feature.scale)})"/>`;
  }

  function featureMarkup(feature, selected) {
    if (feature.type === 'stamp') {
      const mark = stampMarkup(feature);
      if (!selected) return mark;
      const radius = (STAMP_R[feature.kind] || 30) * feature.scale + 8;
      return `${mark}<circle cx="${r1(feature.x)}" cy="${r1(feature.y)}" r="${r1(radius)}" fill="none" stroke="#5df0cf" stroke-width="2" stroke-dasharray="5 4"/>`;
    }
    const body = pathMarkup(feature);
    if (!selected) return body;
    const d = `${pathD(feature.points)}${isGround(feature) ? ' Z' : ''}`;
    const halo = feature.style === 'wall' ? feature.width * 1.7 : isGround(feature) ? 16 : feature.width + 14;
    const handleR = 7 / Math.max(view.z, 0.05);
    const handleStroke = 1.6 / Math.max(view.z, 0.05);
    const handles = feature.points.map((point, index) => {
      const hot = index === vertexIndex;
      return `<circle cx="${r1(point.x)}" cy="${r1(point.y)}" r="${r1(handleR)}" fill="${hot ? '#5df0cf' : '#f7fbff'}" stroke="#16324c" stroke-width="${r1(handleStroke)}"/>`;
    }).join('');
    return `<path d="${d}" fill="none" stroke="#5df0cf" stroke-width="${r1(halo)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>${body}${handles}`;
  }

  function isGround(feature) {
    return feature?.type === 'path' && feature.style === 'ground';
  }

  function islandPoints(width, height) {
    const sx = width / 2000;
    const sy = height / 1400;
    let x = 300;
    let y = 250;
    const points = [];
    ISLAND_CURVES.forEach((curve) => {
      for (let step = 0; step < 6; step += 1) {
        const t = step / 6;
        const u = 1 - t;
        points.push({
          x: (u * u * x + 2 * u * t * curve.c[0] + t * t * curve.e[0]) * sx,
          y: (u * u * y + 2 * u * t * curve.c[1] + t * t * curve.e[1]) * sy,
        });
      }
      x = curve.e[0];
      y = curve.e[1];
    });
    return points;
  }

  function groundShape(feature) {
    const d = `${pathD(feature.points)} Z`;
    const opacity = clamp(num(feature.opacity, 1), 0, 1);
    return `<g opacity="${opacity}">
      <path d="${d}" fill="#0a1c31" transform="translate(8 12)" filter="url(#soft)" opacity="0.85"/>
      <path d="${d}" fill="url(#snow)" stroke="#cfe9f8" stroke-width="5" stroke-linejoin="round"/>
    </g>`;
  }

  function skyMarkup(drawing) {
    return `<rect width="${drawing.width}" height="${drawing.height}" fill="url(#sky)"/>`;
  }

  function referenceMarkup() {
    const ref = doc?.reference;
    if (!ref) return '';
    if (!blobUrl) {
      return `<rect x="${r1(ref.x)}" y="${r1(ref.y)}" width="${r1(ref.w)}" height="${r1(ref.h)}" fill="none" stroke="#5df0cf" stroke-dasharray="8 6"/>`;
    }
    const cx = ref.w / 2;
    const cy = ref.h / 2;
    return `<g transform="translate(${r1(ref.x + cx)} ${r1(ref.y + cy)}) rotate(${r1(ref.rotation)}) translate(${r1(-cx)} ${r1(-cy)})">
      <image href="${blobUrl}" x="0" y="0" width="${r1(ref.w)}" height="${r1(ref.h)}" opacity="${ref.opacity}" preserveAspectRatio="none"/>
    </g>`;
  }

  function sceneMarkup(drawing, { reference = false, editor = false } = {}) {
    const paint = (feature) => featureMarkup(feature, editor && feature.id === selectedId);
    const grounds = drawing.features.filter(isGround).map(paint).join('');
    const features = drawing.features.filter((feature) => !isGround(feature)).map(paint).join('');
    let draftMarkup = '';
    if (editor && draft.length) {
      const style = $('drawPathStyle').value;
      draftMarkup = featureMarkup({
        type: 'path',
        style,
        width: clamp(Math.round(num($('drawPathWidth').value, style === 'wall' ? WALL_WIDTH : PATH_WIDTH)), 4, 200),
        opacity: style === 'ground' ? clamp(num($('drawGroundOpacity').value, 1), 0, 1) : 1,
        points: draft.length === 1 ? [draft[0], draft[0]] : draft,
      }, false);
    }
    const frame = editor
      ? `<rect x="1" y="1" width="${drawing.width - 2}" height="${drawing.height - 2}" fill="none" stroke="rgba(166,203,226,0.45)" stroke-width="${r1(2 / Math.max(view.z, 0.05))}"/>`
      : '';
    const photo = reference ? referenceMarkup() : '';
    return `${skyMarkup(drawing)}${grounds}${photo}${features}${draftMarkup}${frame}`;
  }

  function svgText(markup, drawing) {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${drawing.width}" height="${drawing.height}" viewBox="0 0 ${drawing.width} ${drawing.height}">
      <defs>${DEFS}</defs>
      ${markup}
    </svg>`;
  }

  function render() {
    if (!doc || !svg) return;
    svg.setAttribute('width', String(doc.width));
    svg.setAttribute('height', String(doc.height));
    svg.setAttribute('viewBox', `0 0 ${doc.width} ${doc.height}`);
    svg.innerHTML = `<defs>${DEFS}</defs>${sceneMarkup(doc, { reference: true, editor: true })}`;
    applyView();
  }

  function exportSvg(drawing) {
    return svgText(sceneMarkup(drawing, { reference: false, editor: false }), drawing);
  }

  function drawActive() {
    return document.querySelector('.view[data-view="draw"]')?.classList.contains('is-active');
  }

  function updateChrome() {
    document.querySelectorAll('#drawTools button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tool === tool);
    });
    document.querySelectorAll('#drawStamps button').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.kind === stampKind);
    });
    stage?.classList.toggle('is-select', tool === 'select');
    stage?.classList.toggle('is-path', tool === 'path');
    stage?.classList.toggle('is-stamp', tool === 'stamp');
    stage?.classList.toggle('is-ref', tool === 'reference');

    const selected = selectedFeature();
    const showPath = tool === 'path' || selected?.type === 'path';
    const showStamp = tool === 'stamp' || selected?.type === 'stamp';
    $('drawPathOptions').hidden = !showPath;
    $('drawStampOptions').hidden = !showStamp;
    $('drawRefOptions').hidden = tool !== 'reference';
    const style = selected?.type === 'path' ? selected.style : $('drawPathStyle').value;
    const ground = showPath && style === 'ground';
    $('drawPathWidth').closest('label').hidden = ground;
    $('drawGroundOpacity').closest('label').hidden = !ground;
    const finish = $('drawFinishPath');
    finish.hidden = tool !== 'path' || draft.length < (style === 'ground' ? 3 : 2);
    finish.textContent = style === 'ground' ? 'Finish shape' : 'Finish path';
    $('drawDelete').hidden = !selected;
    $('drawFront').hidden = !selected;

    const hint = $('drawHint');
    if (hint) {
      let hintKey = tool;
      if (tool === 'select' && selected?.type === 'path') hintKey = selected.style === 'wall' ? 'wallOpen' : 'points';
      else if (tool === 'path' && (style === 'wall' || style === 'ground')) hintKey = style;
      hint.innerHTML = `<strong>${tool === 'reference' ? 'Line up the photo.' : 'Draw what the photo can’t show.'}</strong>${HINTS[hintKey] || ''}`;
    }

    const list = $('drawFeatureList');
    if (!list || !doc) return;
    const scroll = list.scrollTop;
    if (!doc.features.length) {
      list.innerHTML = '<p>Nothing drawn yet.</p>';
      return;
    }
    list.innerHTML = [...doc.features].reverse().map((feature) => {
      const label = feature.type === 'path' ? STYLE_LABEL[feature.style] : STAMP_LABEL[feature.kind];
      const on = feature.id === selectedId ? ' is-active' : '';
      return `<button type="button" data-id="${feature.id}" class="${on.trim()}">${label}</button>`;
    }).join('');
    list.scrollTop = scroll;
  }

  function syncInputs() {
    if (!doc) return;
    syncing = true;
    $('drawCanvasW').value = String(doc.width);
    $('drawCanvasH').value = String(doc.height);
    const selected = selectedFeature();
    if (selected?.type === 'path') {
      $('drawPathStyle').value = selected.style;
      $('drawPathWidth').value = String(selected.width);
      if (selected.style === 'ground') $('drawGroundOpacity').value = String(num(selected.opacity, 1));
    }
    if (selected?.type === 'stamp') {
      stampKind = selected.kind;
      $('drawStampScale').value = String(selected.scale);
      $('drawStampRotation').value = String(selected.rotation);
    }
    if (doc.reference) {
      $('drawRefOpacity').value = String(doc.reference.opacity);
      $('drawRefWidth').value = String(Math.round(doc.reference.w));
      $('drawRefRotation').value = String(Math.round(doc.reference.rotation));
      $('drawRefLock').checked = Boolean(doc.reference.locked);
    }
    syncing = false;
  }

  function edit(fn) {
    snapshot();
    fn();
    rev += 1;
    render();
    updateChrome();
    scheduleSave();
  }

  function setTool(next) {
    if (tool === 'path' && next !== tool) finishDraft();
    if (next !== tool) vertexIndex = null;
    tool = next;
    updateChrome();
  }

  function finishDraft() {
    if (draft.length < 2) {
      draft = [];
      render();
      updateChrome();
      return;
    }
    const points = draft.map((p) => ({ x: p.x, y: p.y }));
    const style = $('drawPathStyle').value;
    if (style === 'ground' && points.length < 3) {
      draft = [];
      render();
      updateChrome();
      return;
    }
    const width = clamp(Math.round(num($('drawPathWidth').value, style === 'wall' ? WALL_WIDTH : PATH_WIDTH)), 4, 200);
    const opacity = clamp(num($('drawGroundOpacity').value, 1), 0, 1);
    draft = [];
    edit(() => {
      const id = nextId();
      const feature = { id, type: 'path', style, width, points };
      if (style === 'ground') {
        feature.opacity = opacity;
        const at = doc.features.findIndex((item) => !isGround(item));
        doc.features.splice(at < 0 ? doc.features.length : at, 0, feature);
      } else {
        doc.features.push(feature);
      }
      selectedId = id;
    });
  }

  function placeStamp(x, y) {
    const scale = clamp(num($('drawStampScale').value, 0.2), 0.04, 8);
    const rotation = num($('drawStampRotation').value, 0);
    edit(() => {
      const id = nextId();
      doc.features.push({ id, type: 'stamp', kind: stampKind, x, y, rotation, scale });
      selectedId = id;
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    const id = selectedId;
    edit(() => {
      doc.features = doc.features.filter((feature) => feature.id !== id);
      selectedId = null;
    });
  }

  function bringFront() {
    if (!selectedId) return;
    const id = selectedId;
    edit(() => {
      const index = doc.features.findIndex((feature) => feature.id === id);
      if (index < 0) return;
      const [item] = doc.features.splice(index, 1);
      if (isGround(item)) {
        const at = doc.features.findIndex((feature) => !isGround(feature));
        doc.features.splice(at < 0 ? doc.features.length : at, 0, item);
      } else {
        doc.features.push(item);
      }
    });
  }

  function doUndo() {
    const prev = undo.pop();
    if (!prev) return;
    doc = JSON.parse(prev);
    selectedId = null;
    vertexIndex = null;
    draft = [];
    rev += 1;
    syncInputs();
    render();
    updateChrome();
    scheduleSave();
  }

  function scaleAll(sx, sy) {
    doc.features.forEach((feature) => {
      if (feature.type === 'stamp') {
        feature.x *= sx;
        feature.y *= sy;
      } else if (feature.type === 'path') {
        feature.points.forEach((p) => {
          p.x *= sx;
          p.y *= sy;
        });
      }
    });
    if (doc.reference) {
      doc.reference.x *= sx;
      doc.reference.y *= sy;
      doc.reference.w *= sx;
      doc.reference.h *= sy;
    }
  }

  function applySize() {
    if (!doc) return;
    const width = clamp(Math.round(num($('drawCanvasW').value, doc.width)), 400, 8000);
    const height = clamp(Math.round(num($('drawCanvasH').value, doc.height)), 400, 8000);
    if (width === doc.width && height === doc.height) return;
    const ok = window.confirm('Pins are placed in this pixel space. Changing the size means they will need to be dragged again.');
    if (!ok) {
      syncInputs();
      return;
    }
    const sx = width / doc.width;
    const sy = height / doc.height;
    edit(() => {
      scaleAll(sx, sy);
      doc.width = width;
      doc.height = height;
    });
    fit();
    fittedFor = currentId;
  }

  async function loadReference(id) {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    if (!doc?.reference) return;
    const res = await fetch(doc.reference.url, {
      headers: { Authorization: `Bearer ${deps.getToken()}` },
    });
    if (currentId !== id || !res.ok) return;
    blobUrl = URL.createObjectURL(await res.blob());
  }

  function ensureBase() {
    if (!doc || doc.baseSeeded) return;
    doc.baseSeeded = true;
    if (!doc.features.some(isGround)) {
      doc.features.unshift({
        id: nextId(),
        type: 'path',
        style: 'ground',
        width: 4,
        opacity: 1,
        points: islandPoints(doc.width, doc.height),
      });
    }
    rev += 1;
    scheduleSave();
  }

  async function load(id) {
    currentId = id;
    fittedFor = null;
    undo = [];
    draft = [];
    selectedId = null;
    pointer = null;
    const body = await deps.api(`/locations/${id}/map`);
    if (currentId !== id) return;
    doc = body.document;
    ensureBase();
    await loadReference(id);
    if (currentId !== id) return;
    syncInputs();
    render();
    updateChrome();
  }

  async function open() {
    if (!deps) return;
    const id = deps.locationId();
    if (!id) return;
    const needsFit = id !== currentId || fittedFor !== id;
    if (id !== currentId) await load(id);
    if (needsFit) {
      setTimeout(() => {
        if (currentId === id) {
          fit();
          fittedFor = id;
        }
      }, 60);
    }
  }

  function contain(natW, natH, boxW, boxH) {
    const scale = Math.min(boxW / natW, boxH / natH);
    const w = natW * scale;
    const h = natH * scale;
    return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
  }

  function measure(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => reject(new Error('image'));
      img.src = url;
    });
  }

  async function postBinary(path, blob, type) {
    const res = await fetch(`/api/admin${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.getToken()}`,
        'Content-Type': type,
      },
      body: blob,
    });
    if (res.status === 401) {
      deps.onAuthFail?.();
      throw new Error('unauthorized');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `http_${res.status}`);
    return body;
  }

  async function importReference(file) {
    if (!currentId || !doc) return;
    await flush();
    const type = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ? file.type : 'image/jpeg';
    const body = await postBinary(`/locations/${currentId}/map/reference`, file, type);
    if (!body?.document) throw new Error('bad_reference');
    doc = body.document;
    await loadReference(currentId);
    const dims = await measure(blobUrl);
    const placed = contain(dims.w, dims.h, doc.width, doc.height);
    snapshot();
    doc.reference.x = placed.x;
    doc.reference.y = placed.y;
    doc.reference.w = placed.w;
    doc.reference.h = placed.h;
    doc.reference.opacity = num(doc.reference.opacity, 0.55);
    rev += 1;
    syncInputs();
    render();
    updateChrome();
    scheduleSave();
    setTool('reference');
  }

  async function removeReference() {
    if (!currentId || !doc?.reference) return;
    await flush();
    clearTimeout(saveTimer);
    rev += 1;
    const body = await deps.api(`/locations/${currentId}/map/reference`, { method: 'DELETE' });
    doc = body.document;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = null;
    syncInputs();
    render();
    updateChrome();
  }

  const stampData = new Map();

  function stampImage(kind, width, height) {
    const href = `/admin/stamps/${kind}.png`;
    const x = Math.round((-width / 2) * 10) / 10;
    const y = Math.round((-height / 2) * 10) / 10;
    return `<image href="${href}" xlink:href="${href}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
  }

  async function inlineStampArt(markup) {
    const names = [...new Set([...markup.matchAll(/\/admin\/stamps\/([a-z0-9]+)\.png/g)].map((match) => match[1]))];
    await Promise.all(names.map(async (name) => {
      if (stampData.has(name)) return;
      const response = await fetch(`/admin/stamps/${name}.png`);
      if (!response.ok) throw new Error('stamp');
      const blob = await response.blob();
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('stamp'));
        reader.readAsDataURL(blob);
      });
      stampData.set(name, data);
    }));
    return markup.replace(/\/admin\/stamps\/([a-z0-9]+)\.png/g, (href, name) => stampData.get(name) || href);
  }

  async function rasterize(svgMarkup, width, height) {
    const inlined = await inlineStampArt(svgMarkup);
    return new Promise((resolve, reject) => {
      const blob = new Blob([inlined], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((webp) => {
          if (webp) resolve(webp);
          else canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('encode'))), 'image/png');
        }, 'image/webp', 0.86);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('svg'));
      };
      img.src = url;
    });
  }

  async function publish() {
    if (!doc || !currentId) return;
    const ok = window.confirm('Publish this picture to every season at this park? The drone photo stays off the guest map.');
    if (!ok) return;
    const button = $('drawPublish');
    button.disabled = true;
    try {
      await flush();
      const image = await rasterize(exportSvg(doc), doc.width, doc.height);
      const type = image.type === 'image/png' ? 'image/png' : 'image/webp';
      await postBinary(`/locations/${currentId}/map/publish`, image, type);
      await deps.onPublished?.();
      deps.toast('Published. Guests at this park now see this map.');
    } catch (err) {
      deps.toast(err.message === 'unauthorized' ? 'Sign in again.' : 'Couldn’t publish that map.', true);
    } finally {
      button.disabled = false;
    }
  }

  function vertexAt(feature, x, y) {
    if (!feature || feature.type !== 'path' || !feature.points) return -1;
    const limit = 10 / Math.max(view.z, 0.05);
    let best = -1;
    let bestDist = limit;
    feature.points.forEach((point, index) => {
      const dist = Math.hypot(x - point.x, y - point.y);
      if (dist <= bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    return best;
  }

  function trimTunnels(feature) {
    if (feature?.style !== 'wall' || !Array.isArray(feature.tunnels)) return;
    const total = polyLength(feature.points);
    feature.tunnels = feature.tunnels.filter((dist) => dist > 0 && dist < total - 0.5);
  }

  function deleteVertex() {
    const feature = selectedFeature();
    if (!feature || feature.type !== 'path' || vertexIndex == null) return false;
    const min = isGround(feature) ? 3 : 2;
    if (feature.points.length <= min) return false;
    const index = vertexIndex;
    vertexIndex = Math.min(index, feature.points.length - 2);
    edit(() => {
      feature.points.splice(index, 1);
      trimTunnels(feature);
    });
    return true;
  }

  function onPointerDown(event) {
    if (!doc || event.button === 2) return;
    if (event.target.closest?.('#drawHint')) return;
    stage.setPointerCapture?.(event.pointerId);
    const world = toWorld(event);
    if (event.button === 1 || event.altKey || tool === 'pan') {
      pointer = { mode: 'pan', sx: event.clientX, sy: event.clientY, vx: view.x, vy: view.y };
      stage.classList.add('is-grabbing');
      return;
    }
    if (tool === 'reference') {
      if (!doc.reference || doc.reference.locked) return;
      snapshot();
      pointer = { mode: 'ref', x0: world.x, y0: world.y, sx: event.clientX, sy: event.clientY, ox: doc.reference.x, oy: doc.reference.y, moved: false };
      return;
    }
    if (tool === 'stamp') {
      placeStamp(world.x, world.y);
      return;
    }
    if (tool === 'path') {
      draft.push({ x: world.x, y: world.y });
      render();
      updateChrome();
      return;
    }
    const hit = hitFeature(world.x, world.y);
    const selected = selectedFeature();
    if (selected?.type === 'path') {
      const index = vertexAt(selected, world.x, world.y);
      if (index >= 0) {
        vertexIndex = index;
        snapshot();
        pointer = {
          mode: 'vertex',
          id: selected.id,
          index,
          x0: world.x,
          y0: world.y,
          sx: event.clientX,
          sy: event.clientY,
          ox: selected.points[index].x,
          oy: selected.points[index].y,
          moved: false,
        };
        syncInputs();
        updateChrome();
        render();
        return;
      }
    }
    vertexIndex = null;
    const tunnel = Boolean(hit && hit.id === selectedId && hit.type === 'path' && hit.style === 'wall');
    selectedId = hit?.id || null;
    syncInputs();
    updateChrome();
    render();
    if (!hit) return;
    snapshot();
    pointer = {
      mode: 'feature',
      id: hit.id,
      x0: world.x,
      y0: world.y,
      sx: event.clientX,
      sy: event.clientY,
      ox: hit.x,
      oy: hit.y,
      points: hit.points ? hit.points.map((p) => ({ ...p })) : null,
      moved: false,
      tunnel,
    };
  }

  function onPointerMove(event) {
    if (!pointer || !doc) return;
    if (pointer.mode === 'pan') {
      view.x = pointer.vx + (event.clientX - pointer.sx);
      view.y = pointer.vy + (event.clientY - pointer.sy);
      applyView();
      return;
    }
    const world = toWorld(event);
    const dx = world.x - pointer.x0;
    const dy = world.y - pointer.y0;
    const screenDx = event.clientX - (pointer.sx ?? event.clientX);
    const screenDy = event.clientY - (pointer.sy ?? event.clientY);
    if (Math.hypot(screenDx, screenDy) > 4) pointer.moved = true;
    if (pointer.mode === 'ref' && doc.reference) {
      doc.reference.x = pointer.ox + dx;
      doc.reference.y = pointer.oy + dy;
      rev += 1;
      render();
      return;
    }
    if (pointer.mode === 'vertex') {
      const feature = doc.features.find((item) => item.id === pointer.id);
      const point = feature?.points?.[pointer.index];
      if (!point) return;
      point.x = pointer.ox + dx;
      point.y = pointer.oy + dy;
      rev += 1;
      render();
      return;
    }
    if (pointer.mode === 'feature') {
      const feature = doc.features.find((item) => item.id === pointer.id);
      if (!feature) return;
      if (feature.type === 'stamp') {
        feature.x = pointer.ox + dx;
        feature.y = pointer.oy + dy;
      } else if (pointer.points) {
        feature.points = pointer.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      rev += 1;
      render();
    }
  }

  function toggleTunnel(id, x, y) {
    const feature = doc.features.find((item) => item.id === id);
    if (!feature || feature.type !== 'path' || feature.style !== 'wall') return;
    const along = closestAlong(feature.points, x, y);
    const total = polyLength(feature.points);
    if (!along || total < 8) return;
    const thick = Math.max(feature.width, 4);
    const mouth = tunnelMetrics(thick).span;
    const edge = Math.min(mouth * 0.55, total * 0.2);
    const dist = clamp(along.d, edge, Math.max(edge, total - edge));
    edit(() => {
      const tunnels = Array.isArray(feature.tunnels) ? feature.tunnels.slice() : [];
      const index = tunnels.findIndex((item) => Math.abs(item - dist) < mouth * 0.55);
      if (index >= 0) tunnels.splice(index, 1);
      else tunnels.push(Math.round(dist * 10) / 10);
      feature.tunnels = tunnels;
    });
  }

  function onPointerUp() {
    stage?.classList.remove('is-grabbing');
    if (!pointer) return;
    const { moved, mode, tunnel, id, x0, y0 } = pointer;
    pointer = null;
    if ((mode === 'ref' || mode === 'feature' || mode === 'vertex') && !moved && undo.length) {
      if (undo[undo.length - 1] === JSON.stringify(doc)) undo.pop();
    } else if (moved && (mode === 'ref' || mode === 'feature' || mode === 'vertex')) {
      if (mode === 'vertex') trimTunnels(doc.features.find((item) => item.id === id));
      scheduleSave();
    }
    if (tunnel && !moved) toggleTunnel(id, x0, y0);
  }

  function onWheel(event) {
    if (!doc) return;
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const beforeX = (px - view.x) / view.z;
    const beforeY = (py - view.y) / view.z;
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    view.z = clamp(view.z * factor, 0.05, 6);
    view.x = px - beforeX * view.z;
    view.y = py - beforeY * view.z;
    render();
  }

  function onDoubleClick() {
    if (tool !== 'path' || draft.length < 2) return;
    const last = draft[draft.length - 1];
    const prev = draft[draft.length - 2];
    if (Math.hypot(last.x - prev.x, last.y - prev.y) < 12) draft.pop();
    finishDraft();
  }

  function onKey(event) {
    if (!drawActive() || !doc) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      doUndo();
      return;
    }
    if (typing) return;
    if (event.key === 'Escape') {
      draft = [];
      selectedId = null;
      vertexIndex = null;
      render();
      updateChrome();
    } else if (event.key === 'Enter' && tool === 'path') {
      finishDraft();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (vertexIndex != null) deleteVertex();
      else deleteSelected();
    }
  }

  function wire() {
    if (!stage || !svg) return;
    const stampBox = $('drawStamps');
    STAMPS.forEach(([kind, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.kind = kind;
      btn.addEventListener('click', () => {
        stampKind = kind;
        const selected = selectedFeature();
        if (selected?.type === 'stamp') edit(() => { selected.kind = kind; });
        else setTool('stamp');
        updateChrome();
      });
      stampBox.appendChild(btn);
    });

    $('drawTools').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-tool]');
      if (!btn) return;
      setTool(btn.dataset.tool);
    });
    $('drawFeatureList').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-id]');
      if (!btn) return;
      if (tool === 'path') finishDraft();
      vertexIndex = null;
      selectedId = btn.dataset.id;
      tool = 'select';
      syncInputs();
      render();
      updateChrome();
    });
    $('drawFinishPath').addEventListener('click', finishDraft);
    $('drawUndo').addEventListener('click', doUndo);
    $('drawDelete').addEventListener('click', deleteSelected);
    $('drawFront').addEventListener('click', bringFront);
    $('drawApplySize').addEventListener('click', applySize);
    $('drawPublish').addEventListener('click', () => { publish(); });
    $('drawRefImport').addEventListener('click', () => $('drawRefFile').click());
    $('drawRefFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        await importReference(file);
        deps?.toast('Photo added. Drag it into place, then lock it.');
      } catch {
        deps?.toast('Couldn’t import that photo.', true);
      }
    });
    $('drawRefClear').addEventListener('click', () => {
      removeReference().catch(() => deps?.toast('Couldn’t remove the photo.', true));
    });
    $('drawPathStyle').addEventListener('change', () => {
      if (syncing) return;
      const style = $('drawPathStyle').value;
      const selected = selectedFeature();
      if (selected?.type === 'path') {
        edit(() => {
          selected.style = style;
          if (style === 'ground') selected.opacity = clamp(num(selected.opacity, 1), 0, 1);
          else delete selected.opacity;
          if (style !== 'wall') delete selected.tunnels;
        });
        return;
      }
      if (style === 'wall') $('drawPathWidth').value = String(WALL_WIDTH);
      else if (Number($('drawPathWidth').value) === WALL_WIDTH) $('drawPathWidth').value = String(PATH_WIDTH);
      render();
      updateChrome();
    });
    $('drawGroundOpacity').addEventListener('pointerdown', () => {
      if (isGround(selectedFeature())) snapshot();
    });
    $('drawGroundOpacity').addEventListener('input', () => {
      if (syncing) return;
      const opacity = clamp(num($('drawGroundOpacity').value, 1), 0, 1);
      const selected = selectedFeature();
      if (isGround(selected)) {
        selected.opacity = opacity;
        rev += 1;
        render();
      } else if ($('drawPathStyle').value === 'ground' && draft.length) {
        render();
      }
    });
    $('drawGroundOpacity').addEventListener('change', () => {
      if (isGround(selectedFeature())) scheduleSave();
    });
    $('drawPathWidth').addEventListener('change', () => {
      if (syncing) return;
      const width = clamp(Math.round(num($('drawPathWidth').value, PATH_WIDTH)), 4, 200);
      const selected = selectedFeature();
      if (selected?.type === 'path') edit(() => { selected.width = width; });
      else $('drawPathWidth').value = String(width);
    });
    $('drawStampScale').addEventListener('change', () => {
      if (syncing) return;
      const scale = clamp(num($('drawStampScale').value, 0.2), 0.04, 8);
      const selected = selectedFeature();
      if (selected?.type === 'stamp') edit(() => { selected.scale = scale; });
      $('drawStampScale').value = String(scale);
    });
    $('drawStampRotation').addEventListener('change', () => {
      if (syncing) return;
      const rotation = num($('drawStampRotation').value, 0);
      const selected = selectedFeature();
      if (selected?.type === 'stamp') edit(() => { selected.rotation = rotation; });
    });
    $('drawRefOpacity').addEventListener('pointerdown', () => {
      if (doc?.reference) snapshot();
    });
    $('drawRefOpacity').addEventListener('input', () => {
      if (syncing || !doc?.reference) return;
      doc.reference.opacity = clamp(num($('drawRefOpacity').value, 0.55), 0, 1);
      rev += 1;
      render();
    });
    $('drawRefOpacity').addEventListener('change', scheduleSave);
    $('drawRefWidth').addEventListener('change', () => {
      if (syncing || !doc?.reference) return;
      const aspect = doc.reference.h / doc.reference.w || 1;
      const width = clamp(num($('drawRefWidth').value, doc.reference.w), 10, 20000);
      edit(() => {
        doc.reference.w = width;
        doc.reference.h = width * aspect;
      });
    });
    $('drawRefRotation').addEventListener('change', () => {
      if (syncing || !doc?.reference) return;
      const rotation = num($('drawRefRotation').value, 0);
      edit(() => { doc.reference.rotation = rotation; });
    });
    $('drawRefLock').addEventListener('change', () => {
      if (syncing || !doc?.reference) return;
      const locked = $('drawRefLock').checked;
      edit(() => { doc.reference.locked = locked; });
    });

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('keydown', onKey);
    updateChrome();
  }

  wire();

  return {
    attach(next) { deps = next; },
    open,
  };
})();

window.ParkDraw = ParkDraw;
