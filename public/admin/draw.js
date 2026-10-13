/* global window, document, fetch, requestAnimationFrame */

/**
 * Park drawing. One document per location. The drone photo is a tracing
 * guide and is left out of the picture guests download.
 */
const ParkDraw = (() => {
  const STAMPS = [
    ['fir1', 'Fir'],
    ['fir2', 'Fir 2'],
    ['fir3', 'Small'],
    ['hut', 'Hut'],
    ['lamp', 'Lamp'],
    ['tower', 'Tower'],
    ['wall', 'Wall'],
  ];
  const STAMP_LABEL = Object.fromEntries(STAMPS);
  const STYLE_LABEL = { snow: 'Snow path', boardwalk: 'Boardwalk', bridge: 'Bridge' };
  const STAMP_R = { fir1: 28, fir2: 24, fir3: 20, hut: 48, lamp: 36, tower: 78, wall: 52 };
  const ISLAND = 'M300 250 q220 -110 520 -80 q210 22 400 -14 q250 -46 400 90 q150 128 96 330 q-52 196 -240 300 q-190 104 -470 122 q-300 20 -560 -34 q-260 -54 -336 -230 q-76 -176 24 -330 q94 -146 166 -154 Z';

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
    <g id="fir1">
      <path d="M0 20 q-4 2 -13 1 q3 -6 8 -9 q-8 1 -14 -1 q5 -8 12 -13 q-7 0 -12 -2 q7 -11 19 -21 q12 10 19 21 q-5 2 -12 2 q7 5 12 13 q-6 2 -14 1 q5 3 8 9 q-9 1 -13 -1 Z" fill="#1f6b63" stroke="#0c3a3c" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M0 -25 q-8 9 -12 18 q6 1 12 -2 Z" fill="#dff3f7" opacity=".5"/>
      <rect x="-2.5" y="19" width="5" height="9" rx="2" fill="#43281a"/>
    </g>
    <g id="fir2">
      <path d="M0 16 q-4 2 -11 1 q3 -5 7 -8 q-7 1 -12 -1 q4 -7 10 -11 q-6 0 -10 -2 q6 -9 16 -18 q10 9 16 18 q-4 2 -10 2 q6 4 10 11 q-5 2 -12 1 q4 3 7 8 q-7 1 -11 -1 Z" fill="#2a7d6b" stroke="#0c3a3c" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M0 -21 q-7 8 -10 15 q5 1 10 -2 Z" fill="#dff3f7" opacity=".45"/>
      <rect x="-2" y="15" width="4" height="8" rx="2" fill="#43281a"/>
    </g>
    <g id="fir3">
      <path d="M0 12 q-3 2 -9 1 q2 -4 6 -7 q-6 1 -10 -1 q4 -6 9 -9 q-5 0 -8 -2 q5 -8 12 -14 q7 6 12 14 q-3 2 -8 2 q5 3 9 9 q-4 2 -10 1 q4 3 6 7 q-6 1 -9 -1 Z" fill="#18594f" stroke="#0c3a3c" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="-1.8" y="11" width="3.6" height="7" rx="1.8" fill="#43281a"/>
    </g>
    <g id="hut">
      <path d="M-34 6 L0 -12 L34 6 L34 30 L0 46 L-34 30 Z" fill="#8d6a4f" stroke="#3a2415" stroke-width="3" stroke-linejoin="round"/>
      <path d="M0 -12 L34 6 L34 30 L0 46 Z" fill="#6f5240"/>
      <path d="M-42 8 L0 -22 L42 8 L0 20 Z" fill="#e9f6fb" stroke="#3a2415" stroke-width="3" stroke-linejoin="round"/>
      <path d="M-14 20 L-14 34 L0 42 L0 26 Z" fill="#ffcf86" stroke="#3a2415" stroke-width="2.4"/>
      <path d="M12 20 L12 32 L24 26 L24 14 Z" fill="#ffcf86" stroke="#3a2415" stroke-width="2.4" opacity=".8"/>
    </g>
    <g id="lamp">
      <circle cx="0" cy="-26" r="26" fill="url(#lampGlow)"/>
      <rect x="-2.2" y="-24" width="4.4" height="30" rx="2" fill="#2b3f52"/>
      <path d="M0 -38 l9 9 l-9 10 l-9 -10 Z" fill="#ffd08f" stroke="#2b3f52" stroke-width="2.2"/>
    </g>
    <g id="tower">
      <path d="M-28 48 L-28 -20 L-16 -58 L0 -86 L16 -58 L28 -20 L28 48 Z" fill="url(#iceFace)" stroke="#2f6f95" stroke-width="3" stroke-linejoin="round"/>
      <path d="M0 -86 L16 -58 L28 -20 L28 48 L0 60 Z" fill="url(#iceSide)" opacity=".85"/>
      <path d="M-10 48 L-10 10 q10 -16 20 0 L10 48 Z" fill="#1c4f73" stroke="#2f6f95" stroke-width="2"/>
      <path d="M0 -86 L0 -108" stroke="#2f6f95" stroke-width="2" fill="none"/>
      <path d="M0 -108 l16 6 l-16 7 Z" fill="#7fe8c8"/>
      <g fill="#f2fcff" opacity=".9">
        <path d="M-28 48 l8 16 l8 -16 Z"/><path d="M-8 48 l8 20 l8 -20 Z"/><path d="M12 48 l8 14 l8 -14 Z"/>
      </g>
    </g>
    <g id="wall">
      <path d="M-48 10 L-48 -8 L-32 -8 L-32 -22 L-16 -22 L-16 -8 L0 -8 L0 -22 L16 -22 L16 -8 L32 -8 L32 -22 L48 -22 L48 10 Z" fill="url(#iceFace)" stroke="#2f6f95" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-48 10 L48 10 L48 20 L-48 20 Z" fill="url(#iceSide)"/>
    </g>
  `;

  const HINTS = {
    pan: 'Drag to move around. Scroll to zoom.',
    select: 'Click a path or stamp, then drag it. Delete removes it.',
    path: 'Click to add points. Double-click or Finish path when the line is done.',
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
  let stampKind = 'tower';
  let selectedId = null;
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

  function hitFeature(x, y) {
    for (let i = doc.features.length - 1; i >= 0; i -= 1) {
      const feature = doc.features[i];
      if (feature.type === 'stamp') {
        const radius = (STAMP_R[feature.kind] || 30) * feature.scale;
        if (Math.hypot(x - feature.x, y - feature.y) <= radius) return feature;
      } else if (feature.type === 'path') {
        const limit = feature.width / 2 + 8;
        for (let p = 1; p < feature.points.length; p += 1) {
          if (distToSeg(x, y, feature.points[p - 1], feature.points[p]) <= limit) return feature;
        }
      }
    }
    return null;
  }

  function pathD(points) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`).join(' ');
  }

  function pathMarkup(feature) {
    const d = pathD(feature.points);
    const w = feature.width;
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
    const d = pathD(feature.points);
    return `<path d="${d}" fill="none" stroke="#5df0cf" stroke-width="${r1(feature.width + 14)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>${body}`;
  }

  function groundMarkup(drawing) {
    const sx = drawing.width / 2000;
    const sy = drawing.height / 1400;
    return `
      <rect width="${drawing.width}" height="${drawing.height}" fill="url(#sky)"/>
      <g transform="scale(${sx} ${sy})">
        <path d="${ISLAND}" fill="#0a1c31" transform="translate(14 22)" filter="url(#soft)" opacity=".85"/>
        <path d="${ISLAND}" fill="url(#snow)" stroke="#cfe9f8" stroke-width="5" stroke-linejoin="round"/>
      </g>`;
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
    const features = drawing.features.map((feature) => featureMarkup(feature, editor && feature.id === selectedId)).join('');
    let draftMarkup = '';
    if (editor && draft.length) {
      draftMarkup = featureMarkup({
        type: 'path',
        style: $('drawPathStyle').value,
        width: clamp(Math.round(num($('drawPathWidth').value, 32)), 4, 200),
        points: draft.length === 1 ? [draft[0], draft[0]] : draft,
      }, false);
    }
    const frame = editor
      ? `<rect x="1" y="1" width="${drawing.width - 2}" height="${drawing.height - 2}" fill="none" stroke="rgba(166,203,226,0.45)" stroke-width="${r1(2 / Math.max(view.z, 0.05))}"/>`
      : '';
    return `${groundMarkup(drawing)}${reference ? referenceMarkup() : ''}${features}${draftMarkup}${frame}`;
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
    $('drawFinishPath').hidden = tool !== 'path' || draft.length < 2;
    $('drawDelete').hidden = !selected;
    $('drawFront').hidden = !selected;

    const hint = $('drawHint');
    if (hint) {
      hint.innerHTML = `<strong>${tool === 'reference' ? 'Line up the photo.' : 'Draw what the photo can’t show.'}</strong>${HINTS[tool] || ''}`;
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
    if (tool === 'path' && next !== 'path') finishDraft();
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
    const width = clamp(Math.round(num($('drawPathWidth').value, 32)), 4, 200);
    draft = [];
    edit(() => {
      const id = nextId();
      doc.features.push({ id, type: 'path', style, width, points });
      selectedId = id;
    });
  }

  function placeStamp(x, y) {
    const scale = clamp(num($('drawStampScale').value, 1), 0.2, 8);
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
      doc.features.push(item);
    });
  }

  function doUndo() {
    const prev = undo.pop();
    if (!prev) return;
    doc = JSON.parse(prev);
    selectedId = null;
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

  function rasterize(svgMarkup, width, height) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
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
      pointer = { mode: 'ref', x0: world.x, y0: world.y, ox: doc.reference.x, oy: doc.reference.y, moved: false };
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
      ox: hit.x,
      oy: hit.y,
      points: hit.points ? hit.points.map((p) => ({ ...p })) : null,
      moved: false,
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
    if (Math.hypot(dx, dy) > 0.5) pointer.moved = true;
    if (pointer.mode === 'ref' && doc.reference) {
      doc.reference.x = pointer.ox + dx;
      doc.reference.y = pointer.oy + dy;
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

  function onPointerUp() {
    stage?.classList.remove('is-grabbing');
    if (!pointer) return;
    const { moved, mode } = pointer;
    pointer = null;
    if ((mode === 'ref' || mode === 'feature') && !moved && undo.length) {
      if (undo[undo.length - 1] === JSON.stringify(doc)) undo.pop();
    } else if (moved && (mode === 'ref' || mode === 'feature')) {
      scheduleSave();
    }
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
    applyView();
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
      render();
      updateChrome();
    } else if (event.key === 'Enter' && tool === 'path') {
      finishDraft();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelected();
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
      const selected = selectedFeature();
      if (selected?.type === 'path') edit(() => { selected.style = $('drawPathStyle').value; });
      else render();
    });
    $('drawPathWidth').addEventListener('change', () => {
      if (syncing) return;
      const width = clamp(Math.round(num($('drawPathWidth').value, 32)), 4, 200);
      const selected = selectedFeature();
      if (selected?.type === 'path') edit(() => { selected.width = width; });
      else $('drawPathWidth').value = String(width);
    });
    $('drawStampScale').addEventListener('change', () => {
      if (syncing) return;
      const scale = clamp(num($('drawStampScale').value, 1), 0.2, 8);
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
