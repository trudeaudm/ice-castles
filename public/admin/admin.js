/* global window, document, L, fetch, sessionStorage */

const KEY = 'ic.admin.v1';
const el = (id) => document.getElementById(id);

const CATEGORIES = ['landmark', 'sculpture', 'lantern', 'photo-op', 'ride', 'amenity'];
const CATEGORY_LABELS = {
  landmark: 'Landmark', sculpture: 'Ice sculpture', lantern: 'Lantern display',
  'photo-op': 'Photo spot', ride: 'Ride', amenity: 'Facilities',
};
const GLYPHS = ['crystal', 'lantern', 'flame', 'wing', 'rune', 'star', 'paw',
  'feather', 'key', 'antler', 'dragon', 'bird', 'bear', 'horse', 'tree'];
const GLYPH_CHARS = {
  crystal: '❄️', lantern: '🏮', flame: '🔥', wing: '🦋', rune: 'ᚦ', star: '✦',
  paw: '🐾', feather: '🪶', key: '🗝️', antler: '🦌', dragon: '🐉', bird: '🕊️',
  bear: '🐻‍❄️', horse: '🐴', tree: '🌲',
};

const colorFor = (category) => `var(--cat-${CATEGORIES.includes(category) ? category : 'landmark'})`;
const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let token = sessionStorage.getItem(KEY) || '';
let state = { settings: {}, pois: [], hunts: [], touchpoints: [], tree: [], adventure: null };
let stats = { perPoi: [], perHunt: [], guests: 0, scans: 0 };
let selectedId = null;
let map = null;
let markers = new Map();
let mapOverlay = null;

const adventureId = () => state.adventure?.id || null;
const locationSlug = () => state.adventure?.venue_code || state.adventure?.location_slug || 'nh';

const CHALLENGE_TYPES = [
  { id: 'scan', label: 'QR scan' },
  { id: 'acknowledge', label: 'Acknowledge' },
  { id: 'code_entry', label: 'Code entry' },
  { id: 'multiple_choice', label: 'Multiple choice' },
  { id: 'reflection', label: 'Reflection' },
  { id: 'image_select', label: 'Image select' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'multi_sequence', label: 'Any-of sequences' },
  { id: 'quiz', label: 'Quiz (no score)' },
];

/* -------------------------------------------------------------------------- */
/* plumbing                                                                   */
/* -------------------------------------------------------------------------- */

async function api(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    signOut();
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `http_${res.status}`);
  }
  return res.json();
}

let toastTimer = null;
function toast(message, bad = false) {
  const node = el('toast');
  node.textContent = message;
  node.classList.toggle('is-bad', bad);
  node.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-on'), 2800);
}

let saveTimer = null;
function flashSaved(text = 'Saved') {
  const node = el('saveState');
  node.textContent = text;
  node.classList.add('is-on');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => node.classList.remove('is-on'), 1600);
}

/* -------------------------------------------------------------------------- */
/* auth                                                                       */
/* -------------------------------------------------------------------------- */

el('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = el('loginError');
  error.hidden = true;
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: el('password').value }),
    });
    if (!res.ok) throw new Error('bad');
    const data = await res.json();
    token = data.token;
    sessionStorage.setItem(KEY, token);
    await start();
  } catch {
    error.textContent = 'That password didn’t work.';
    error.hidden = false;
  }
});

function signOut() {
  sessionStorage.removeItem(KEY);
  token = '';
  el('shell').hidden = true;
  el('gate').hidden = false;
}
el('signOut').addEventListener('click', signOut);
el('gridToggle').addEventListener('click', toggleGrid);

/* -------------------------------------------------------------------------- */
/* tabs                                                                      */
/* -------------------------------------------------------------------------- */

el('tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('is-active', view.dataset.view === tab.dataset.tab);
  });
  if (tab.dataset.tab === 'map' && map) setTimeout(() => map.invalidateSize(), 60);
  if (tab.dataset.tab === 'signs') renderSigns();
  if (tab.dataset.tab === 'journey') renderTouchpoints();
  if (tab.dataset.tab === 'settings') loadStats();
});

/* -------------------------------------------------------------------------- */
/* map                                                                        */
/* -------------------------------------------------------------------------- */

const mapDims = () => ({
  width: Number(state.settings.map_width) || 2000,
  height: Number(state.settings.map_height) || 1400,
});

const toLatLng = (x, y) => L.latLng(mapDims().height - y, x);
const fromLatLng = (latlng) => ({ x: Math.round(latlng.lng), y: Math.round(mapDims().height - latlng.lat) });


/* ---- reference grid (authoring aid, never shipped to guests) ------------- */

let gridLayer = null;
let gridOn = localStorage.getItem('ic_grid') !== '0';

const gridCell = () => Number(state.settings.grid_cell) || 100;

/** "F7" for the cell a pixel coordinate falls in. */
const cellRef = (x, y) =>
  typeof ParkGrid === 'undefined' ? '—' : ParkGrid.cellFor(x, y, gridCell());

function updateGridButton() {
  const button = document.getElementById('gridToggle');
  if (!button) return;
  button.classList.toggle('is-active', gridOn);
  button.textContent = gridOn ? 'Grid on' : 'Grid off';
  button.setAttribute('aria-pressed', String(gridOn));
}

function toggleGrid() {
  gridOn = !gridOn;
  localStorage.setItem('ic_grid', gridOn ? '1' : '0');
  if (gridLayer && map) {
    if (gridOn) gridLayer.addTo(map);
    else map.removeLayer(gridLayer);
  }
  updateGridButton();
}

function rebuildGrid() {
  if (!map || typeof ParkGrid === 'undefined') return;
  if (gridLayer) map.removeLayer(gridLayer);
  const { width, height } = mapDims();
  gridLayer = ParkGrid.createGridLayer(L, { width, height, cell: gridCell() });
  if (gridOn) gridLayer.addTo(map);
}

function initMap() {
  const { width, height } = mapDims();
  map = L.map('adminMap', {
    crs: L.CRS.Simple,
    minZoom: -3,
    maxZoom: 2,
    zoomSnap: 0.25,
    attributionControl: false,
  });
  const bounds = L.latLngBounds(toLatLng(0, height), toLatLng(width, 0));
  mapOverlay = L.imageOverlay(state.settings.map_image_url || '/assets/park-map.webp', bounds).addTo(map);
  map.setMaxBounds(bounds.pad(0.25));
  map.fitBounds(bounds);

  // Core handlers first. If the grid block below throws (e.g. ParkGrid missing
  // because a stale cached shell omitted grid.js), marker placement still works.
  map.on('click', async (event) => {
    const { x, y } = fromLatLng(event.latlng);
    if (!adventureId()) return toast('Pick an adventure first.', true);
    try {
      const poi = await api('/pois', {
        method: 'POST',
        body: JSON.stringify({ name: 'New marker', x, y, published: false, adventure_id: adventureId() }),
      });
      state.pois.push(poi);
      renderMarkers();
      renderTable();
      select(poi.id);
      toast('Marker added. Give it a name and turn it on.');
    } catch {
      toast('Couldn’t add that marker.', true);
    }
  });

  // Reference grid. Working layer only — never part of what a guest loads.
  // Positions can be spoken out loud ("the golem is in E3") while the real
  // artwork is still being drawn from overhead photos.
  if (typeof ParkGrid === 'undefined') {
    console.warn('Reference grid unavailable; continuing without it.');
  } else {
    gridLayer = ParkGrid.createGridLayer(L, { width, height, cell: gridCell() });
    if (gridOn) gridLayer.addTo(map);
  }
  updateGridButton();
}

function markerIcon(poi) {
  const node = document.createElement('div');
  node.className = `apin${poi.published ? '' : ' is-draft'}${poi.id === selectedId ? ' is-selected' : ''}`;
  node.style.setProperty('--pin-color', colorFor(poi.category));
  node.innerHTML = `<span class="apin__gem"></span><span class="apin__name"></span>`;
  node.querySelector('.apin__name').textContent = poi.name;
  return L.divIcon({ html: node.outerHTML, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
}

function renderMarkers() {
  markers.forEach((marker) => map.removeLayer(marker));
  markers = new Map();

  state.pois.forEach((poi) => {
    const marker = L.marker(toLatLng(poi.x, poi.y), {
      icon: markerIcon(poi),
      draggable: true,
      autoPan: true,
    }).addTo(map);

    marker.on('click', () => select(poi.id));

    marker.on('dragend', async () => {
      const { x, y } = fromLatLng(marker.getLatLng());
      poi.x = x;
      poi.y = y;
      try {
        await api(`/pois/${poi.id}/position`, { method: 'PATCH', body: JSON.stringify({ x, y }) });
        flashSaved('Position saved');
        if (poi.id === selectedId) fillForm(poi);
        renderTable();
      } catch {
        toast('Couldn’t save that position.', true);
      }
    });

    markers.set(poi.id, marker);
  });
}

function select(poiId) {
  selectedId = poiId;
  const poi = state.pois.find((p) => p.id === poiId);
  markers.forEach((marker, id) => {
    const node = marker.getElement()?.querySelector('.apin');
    if (node) node.classList.toggle('is-selected', id === poiId);
  });
  if (!poi) {
    el('poiForm').hidden = true;
    el('inspectorEmpty').hidden = false;
    return;
  }
  el('inspectorEmpty').hidden = true;
  el('poiForm').hidden = false;
  fillForm(poi);
}

function fillForm(poi) {
  const form = el('poiForm');
  form.name.value = poi.name || '';
  form.category.value = CATEGORIES.includes(poi.category) ? poi.category : 'landmark';
  form.zone.value = poi.zone || '';
  form.blurb.value = poi.blurb || '';
  form.description.value = poi.description || '';
  form.fun_fact.value = poi.fun_fact || '';
  form.image_url.value = poi.image_url || '';
  form.x.value = Math.round(poi.x);
  form.y.value = Math.round(poi.y);
  form.published.checked = poi.published === 1 || poi.published === true;
  el('poiCode').textContent = poi.scan_code || '------';
  const qrSvg = `/api/admin/qr/${poi.id}.svg?token=${encodeURIComponent(token)}`;
  const qrPng = `/api/admin/qr/${poi.id}.png?token=${encodeURIComponent(token)}`;
  el('qrLink').href = qrSvg;
  el('qrPngLink').href = qrPng;
  el('qrPngLink').download = `${poi.scan_code || 'marker'}-qr.png`;
  el('qrPngCopy').dataset.copyQr = qrPng;
}

el('poiForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    name: form.name.value,
    category: form.category.value,
    zone: form.zone.value,
    blurb: form.blurb.value,
    description: form.description.value,
    fun_fact: form.fun_fact.value,
    image_url: form.image_url.value,
    x: Number(form.x.value),
    y: Number(form.y.value),
    published: form.published.checked,
  };
  try {
    const updated = await api(`/pois/${selectedId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    const index = state.pois.findIndex((p) => p.id === updated.id);
    if (index >= 0) state.pois[index] = updated;
    renderMarkers();
    renderTable();
    select(updated.id);
    flashSaved();
    toast('Marker saved.');
  } catch {
    toast('Couldn’t save that marker.', true);
  }
});

el('deletePoi').addEventListener('click', async () => {
  const poi = state.pois.find((p) => p.id === selectedId);
  if (!poi) return;
  if (!confirm(`Delete "${poi.name}"? Any trail stop using it is removed too.`)) return;
  try {
    await api(`/pois/${poi.id}`, { method: 'DELETE' });
    state.pois = state.pois.filter((p) => p.id !== poi.id);
    state.hunts.forEach((hunt) => { hunt.stops = hunt.stops.filter((s) => s.poi_id !== poi.id); });
    selectedId = null;
    renderMarkers();
    renderTable();
    renderHunts();
    select(null);
    toast('Marker deleted.');
  } catch {
    toast('Couldn’t delete that marker.', true);
  }
});

/* -------------------------------------------------------------------------- */
/* markers table                                                              */
/* -------------------------------------------------------------------------- */

const scanCountFor = (poiId) => stats.perPoi.find((row) => row.id === poiId)?.scans ?? 0;

function renderTable() {
  const body = el('poiTable').querySelector('tbody');
  if (!state.pois.length) {
    body.innerHTML = `<tr><td colspan="8" class="muted" style="padding:26px;text-align:center">
      No markers yet. Add one here, or click straight onto the map.</td></tr>`;
    return;
  }
  body.innerHTML = state.pois.map((poi) => `
    <tr>
      <td class="name">${escapeHtml(poi.name)}</td>
      <td><span class="gemTag" style="--pin-color:${colorFor(poi.category)}">${escapeHtml(CATEGORY_LABELS[poi.category] || poi.category)}</span></td>
      <td class="muted">${escapeHtml(poi.zone || '—')}</td>
      <td class="mono muted"><span class="cellRef">${cellRef(poi.x, poi.y)}</span><br><span style="opacity:.6">${Math.round(poi.x)}, ${Math.round(poi.y)}</span></td>
      <td class="mono" style="color:var(--lantern)">${escapeHtml(poi.scan_code || '—')}</td>
      <td><span class="pill ${poi.published ? 'pill--on' : 'pill--off'}">${poi.published ? 'Live' : 'Draft'}</span></td>
      <td class="mono muted">${scanCountFor(poi.id)}</td>
      <td><div class="rowActions">
        <button class="iconButton" data-edit="${escapeHtml(poi.id)}" type="button">Edit on map</button>
        <button class="iconButton" data-roll="${escapeHtml(poi.id)}" type="button">Roll code</button>
      </div></td>
    </tr>`).join('');
}

el('poiTable').addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit]');
  if (edit) {
    document.querySelector('.tab[data-tab="map"]').click();
    select(edit.dataset.edit);
    const poi = state.pois.find((p) => p.id === edit.dataset.edit);
    if (poi) map.setView(toLatLng(poi.x, poi.y), Math.max(map.getZoom(), 0));
    return;
  }
  const roll = event.target.closest('[data-roll]');
  if (roll) {
    if (!confirm('Roll this code? Any sign already printed with the old code stops working.')) return;
    try {
      const data = await api(`/pois/${roll.dataset.roll}/rotate-code`, { method: 'POST' });
      const poi = state.pois.find((p) => p.id === roll.dataset.roll);
      if (poi) poi.scan_code = data.scan_code;
      renderTable();
      if (selectedId === roll.dataset.roll) fillForm(poi);
      toast(`New code: ${data.scan_code}. Reprint the sign.`);
    } catch {
      toast('Couldn’t roll that code.', true);
    }
  }
});

el('addPoiButton').addEventListener('click', async () => {
  const { width, height } = mapDims();
  if (!adventureId()) return toast('Pick an adventure first.', true);
  try {
    const poi = await api('/pois', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New marker',
        x: Math.round(width / 2),
        y: Math.round(height / 2),
        published: false,
        adventure_id: adventureId(),
      }),
    });
    state.pois.push(poi);
    renderMarkers();
    renderTable();
    document.querySelector('.tab[data-tab="map"]').click();
    select(poi.id);
    map.setView(toLatLng(poi.x, poi.y), 0);
    toast('Marker added at the centre — drag it where it belongs.');
  } catch {
    toast('Couldn’t add that marker.', true);
  }
});

/* -------------------------------------------------------------------------- */
/* trails                                                                     */
/* -------------------------------------------------------------------------- */

function renderHunts() {
  const list = el('huntList');
  if (!state.hunts.length) {
    list.innerHTML = `<p class="pane__note">No trails yet. A trail needs at least two stops to feel like a hunt.</p>`;
    return;
  }

  list.innerHTML = state.hunts.map((hunt) => {
    const used = new Set(hunt.stops.map((s) => s.poi_id));
    const available = state.pois.filter((p) => !used.has(p.id));

    const stops = hunt.stops.map((stop) => {
      const poi = state.pois.find((p) => p.id === stop.poi_id);
      const type = stop.challenge_type || 'scan';
      return `
        <div class="stopRow" data-stop="${escapeHtml(stop.id)}">
          <span class="stopRow__glyph">${GLYPH_CHARS[stop.token_glyph] || '❄️'}</span>
          <div class="stopRow__body">
            <p class="stopRow__name">${escapeHtml(poi ? poi.name : 'Missing marker')}</p>
            <p class="stopRow__hint">${escapeHtml(stop.token_name)} · ${escapeHtml(type)}</p>
          </div>
          <button class="iconButton" data-edit-stop="${escapeHtml(stop.id)}" type="button">Edit</button>
          <button class="iconButton" data-del-stop="${escapeHtml(stop.id)}" type="button">Remove</button>
        </div>`;
    }).join('');

    return `
      <article class="huntCard" data-hunt="${escapeHtml(hunt.id)}">
        <div class="huntCard__head">
          <div>
            <h3 class="huntCard__title">${escapeHtml(hunt.title)}</h3>
            <p class="huntCard__meta">${hunt.stops.length} stop${hunt.stops.length === 1 ? '' : 's'} ·
              ${hunt.active ? 'live' : 'paused'} · reward code ${escapeHtml(hunt.reward_code || '—')}</p>
          </div>
          <div class="huntCard__actions">
            <button class="iconButton" data-toggle-hunt="${escapeHtml(hunt.id)}" type="button">${hunt.active ? 'Pause' : 'Go live'}</button>
            <button class="dangerButton" data-del-hunt="${escapeHtml(hunt.id)}" type="button">Delete</button>
          </div>
        </div>

        <div class="huntGrid">
          <form class="form" data-hunt-form="${escapeHtml(hunt.id)}">
            <label>Title<input name="title" value="${escapeHtml(hunt.title)}" maxlength="120"></label>
            <label>Tagline<input name="tagline" value="${escapeHtml(hunt.tagline || '')}" maxlength="200"></label>
            <label>How it works<textarea name="description" rows="3" maxlength="2000">${escapeHtml(hunt.description || '')}</textarea></label>
            <label>Reward name<input name="reward_title" value="${escapeHtml(hunt.reward_title || '')}" maxlength="120"></label>
            <label>How to claim it<textarea name="reward_body" rows="2" maxlength="1000">${escapeHtml(hunt.reward_body || '')}</textarea></label>
            <label>Redeem code shown to guests<input name="reward_code" value="${escapeHtml(hunt.reward_code || '')}" maxlength="40"></label>
            <div class="form__foot"><button class="primaryButton" type="submit">Save trail</button></div>
          </form>

          <div>
            <p class="subLabel">Stops in order</p>
            ${stops || '<p class="pane__note">No stops yet.</p>'}
            <div class="addStop">
              <select data-add-stop-select="${escapeHtml(hunt.id)}">
                <option value="">Add a stop…</option>
                ${available.map((poi) => `<option value="${escapeHtml(poi.id)}">${escapeHtml(poi.name)}</option>`).join('')}
              </select>
              <button class="primaryButton" data-add-stop="${escapeHtml(hunt.id)}" type="button">Add</button>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');
}

el('addHuntButton').addEventListener('click', async () => {
  if (!adventureId()) return toast('Pick an adventure first.', true);
  try {
    const hunt = await api('/hunts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New trail',
        tagline: 'Find them all.',
        reward_title: 'Reward unlocked',
        reward_body: 'Show this screen at the Warming Hut to claim it.',
        active: false,
        adventure_id: adventureId(),
      }),
    });
    hunt.stops = [];
    state.hunts.push(hunt);
    renderHunts();
    toast('Trail created. Add stops, then set it live.');
  } catch {
    toast('Couldn’t create that trail.', true);
  }
});

el('huntList').addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-hunt-form]');
  if (!form) return;
  event.preventDefault();
  const huntId = form.dataset.huntForm;
  try {
    const updated = await api(`/hunts/${huntId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: form.title.value,
        tagline: form.tagline.value,
        description: form.description.value,
        reward_title: form.reward_title.value,
        reward_body: form.reward_body.value,
        reward_code: form.reward_code.value,
      }),
    });
    const index = state.hunts.findIndex((h) => h.id === huntId);
    updated.stops = state.hunts[index].stops;
    state.hunts[index] = updated;
    renderHunts();
    flashSaved();
    toast('Trail saved.');
  } catch {
    toast('Couldn’t save that trail.', true);
  }
});

el('huntList').addEventListener('click', async (event) => {
  const target = event.target;

  const toggle = target.closest('[data-toggle-hunt]');
  if (toggle) {
    const hunt = state.hunts.find((h) => h.id === toggle.dataset.toggleHunt);
    const updated = await api(`/hunts/${hunt.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !hunt.active }),
    }).catch(() => null);
    if (!updated) return toast('Couldn’t change that.', true);
    updated.stops = hunt.stops;
    state.hunts[state.hunts.indexOf(hunt)] = updated;
    renderHunts();
    toast(updated.active ? 'Trail is live for guests.' : 'Trail paused — guests keep what they collected.');
    return;
  }

  const delHunt = target.closest('[data-del-hunt]');
  if (delHunt) {
    const hunt = state.hunts.find((h) => h.id === delHunt.dataset.delHunt);
    if (!confirm(`Delete "${hunt.title}"? Guest progress on it is deleted too.`)) return;
    await api(`/hunts/${hunt.id}`, { method: 'DELETE' }).catch(() => null);
    state.hunts = state.hunts.filter((h) => h.id !== hunt.id);
    renderHunts();
    toast('Trail deleted.');
    return;
  }

  const add = target.closest('[data-add-stop]');
  if (add) {
    const huntId = add.dataset.addStop;
    const select = el('huntList').querySelector(`[data-add-stop-select="${huntId}"]`);
    const poiId = select.value;
    if (!poiId) return toast('Pick a marker first.');
    const poi = state.pois.find((p) => p.id === poiId);
    try {
      const stop = await api(`/hunts/${huntId}/stops`, {
        method: 'POST',
        body: JSON.stringify({
          poi_id: poiId,
          token_name: `${poi.name} token`,
          token_glyph: 'crystal',
          hint: '',
        }),
      });
      state.hunts.find((h) => h.id === huntId).stops.push(stop);
      renderHunts();
      toast('Stop added.');
    } catch {
      toast('Couldn’t add that stop.', true);
    }
    return;
  }

  const delStop = target.closest('[data-del-stop]');
  if (delStop) {
    await api(`/stops/${delStop.dataset.delStop}`, { method: 'DELETE' }).catch(() => null);
    state.hunts.forEach((hunt) => {
      hunt.stops = hunt.stops.filter((s) => s.id !== delStop.dataset.delStop);
    });
    renderHunts();
    toast('Stop removed.');
    return;
  }

  const editStop = target.closest('[data-edit-stop]');
  if (editStop) openStopEditor(editStop.dataset.editStop);
});

/** Inline editor for a stop: token, glyph, hint, and challenge activation. */
function openStopEditor(stopId) {
  const hunt = state.hunts.find((h) => h.stops.some((s) => s.id === stopId));
  const stop = hunt.stops.find((s) => s.id === stopId);
  const row = el('huntList').querySelector(`[data-stop="${stopId}"]`);
  let config = {};
  try { config = stop.challenge_config ? JSON.parse(stop.challenge_config) : {}; } catch { config = {}; }
  const type = stop.challenge_type || 'scan';

  row.innerHTML = `
    <div style="flex:1;display:grid;gap:8px">
      <input data-field="token_name" value="${escapeHtml(stop.token_name)}" placeholder="Token name" maxlength="80">
      <input data-field="hint" value="${escapeHtml(stop.hint || '')}" placeholder="Hint guests see before they find it" maxlength="400">
      <select data-field="token_glyph">
        ${GLYPHS.map((g) => `<option value="${g}"${g === stop.token_glyph ? ' selected' : ''}>${GLYPH_CHARS[g]} ${g}</option>`).join('')}
      </select>
      <label style="display:grid;gap:4px;font-size:12px;color:var(--frost-500)">
        Activation
        <select data-field="challenge_type">
          ${CHALLENGE_TYPES.map((t) => `<option value="${t.id}"${t.id === type ? ' selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </label>
      <textarea data-field="challenge_config" rows="4" placeholder='Config JSON — e.g. {"code":"SPARK"} or {"question":"...","choices":["A","B"],"correctIndex":0}'>${escapeHtml(stop.challenge_config || (Object.keys(config).length ? JSON.stringify(config, null, 2) : ''))}</textarea>
      <div style="display:flex;gap:7px">
        <button class="primaryButton" data-save-stop="${escapeHtml(stopId)}" type="button">Save stop</button>
        <button class="iconButton" data-cancel-stop type="button">Cancel</button>
      </div>
    </div>`;

  row.querySelector('[data-cancel-stop]').addEventListener('click', renderHunts);
  row.querySelector('[data-save-stop]').addEventListener('click', async () => {
    const payload = {};
    row.querySelectorAll('[data-field]').forEach((input) => { payload[input.dataset.field] = input.value; });
    if (payload.challenge_config) {
      try {
        payload.challenge_config = JSON.parse(payload.challenge_config);
      } catch {
        return toast('Challenge config must be valid JSON.', true);
      }
    } else {
      payload.challenge_config = null;
    }
    try {
      const updated = await api(`/stops/${stopId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      Object.assign(stop, updated);
      renderHunts();
      flashSaved();
      toast('Stop saved.');
    } catch {
      toast('Couldn’t save that stop.', true);
    }
  });
}

/* -------------------------------------------------------------------------- */
/* journey touchpoints                                                        */
/* -------------------------------------------------------------------------- */

const TOUCH_TYPES = [
  { id: 'threshold', label: 'Threshold' },
  { id: 'guardian', label: 'Guardian' },
  { id: 'monument', label: 'Builder’s Monument' },
  { id: 'heart', label: 'Heart of Winter' },
];

function renderTouchpoints() {
  const list = el('touchList');
  if (!list) return;
  const rows = state.touchpoints || [];
  if (!rows.length) {
    list.innerHTML = `<p class="pane__note">No journey pages yet. Add a Threshold to greet guests on arrival.</p>`;
    return;
  }
  list.innerHTML = rows.map((tp) => {
    const poi = state.pois.find((p) => p.id === tp.poi_id);
    return `<article class="huntCard" data-touch="${escapeHtml(tp.id)}">
      <div class="huntCard__head">
        <div>
          <h3 class="huntCard__title">${escapeHtml(tp.title)}</h3>
          <p class="huntCard__meta">${escapeHtml(tp.type)} · ${escapeHtml(tp.slug)}${poi ? ` · ${escapeHtml(poi.name)}` : ''}</p>
        </div>
        <button class="dangerButton" data-del-touch="${escapeHtml(tp.id)}" type="button">Delete</button>
      </div>
      <form class="form" data-touch-form="${escapeHtml(tp.id)}">
        <div class="form__row">
          <label>Type
            <select name="type">
              ${TOUCH_TYPES.map((t) => `<option value="${t.id}"${t.id === tp.type ? ' selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </label>
          <label>Element<input name="element" value="${escapeHtml(tp.element || '')}" maxlength="40" placeholder="water"></label>
        </div>
        <label>Permanent URL slug<input name="slug" value="${escapeHtml(tp.slug)}" maxlength="60" placeholder="cascade"></label>
        <label>Title<input name="title" value="${escapeHtml(tp.title)}" maxlength="120"></label>
        <label>Subtitle<input name="subtitle" value="${escapeHtml(tp.subtitle || '')}" maxlength="200"></label>
        <label>Meet / story<textarea name="body" rows="4" maxlength="8000">${escapeHtml(tp.body || '')}</textarea></label>
        <label>Discover<textarea name="discover_body" rows="3" maxlength="8000">${escapeHtml(tp.discover_body || '')}</textarea></label>
        <div class="form__row">
          <label>Challenge
            <select name="challenge_type">
              <option value="">None</option>
              ${CHALLENGE_TYPES.map((t) => `<option value="${t.id}"${t.id === (tp.challenge_type || '') ? ' selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </label>
        </div>
        <label>Challenge config (JSON)
          <textarea name="config" rows="5">${escapeHtml(tp.config || '')}</textarea>
        </label>
        <label>Linked marker
          <select name="poi_id">
            <option value="">None</option>
            ${state.pois.map((p) => `<option value="${escapeHtml(p.id)}"${p.id === tp.poi_id ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </label>
        <label class="check"><input type="checkbox" name="published"${tp.published ? ' checked' : ''}><span>Visible to guests</span></label>
        <div class="form__foot"><button class="primaryButton" type="submit">Save</button></div>
      </form>
    </article>`;
  }).join('');
}

el('addTouchButton')?.addEventListener('click', async () => {
  if (!adventureId()) return toast('Pick an adventure first.', true);
  try {
    const tp = await api('/touchpoints', {
      method: 'POST',
      body: JSON.stringify({
        adventure_id: adventureId(),
        type: 'guardian',
        title: 'New touchpoint',
        subtitle: '',
        body: '',
        published: false,
      }),
    });
    state.touchpoints = state.touchpoints || [];
    state.touchpoints.push(tp);
    renderTouchpoints();
    toast('Touchpoint added.');
  } catch {
    toast('Couldn’t add that touchpoint.', true);
  }
});

el('touchList')?.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-touch-form]');
  if (!form) return;
  event.preventDefault();
  const id = form.dataset.touchForm;
  try {
    const updated = await api(`/touchpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        type: form.type.value,
        slug: form.slug.value,
        element: form.element.value,
        title: form.title.value,
        subtitle: form.subtitle.value,
        body: form.body.value,
        discover_body: form.discover_body.value,
        challenge_type: form.challenge_type.value || null,
        config: form.config.value.trim() ? JSON.parse(form.config.value) : null,
        poi_id: form.poi_id.value || null,
        published: form.published.checked,
      }),
    });
    const idx = state.touchpoints.findIndex((t) => t.id === id);
    if (idx >= 0) state.touchpoints[idx] = updated;
    renderTouchpoints();
    flashSaved();
    toast('Journey page saved.');
  } catch {
    toast('Couldn’t save that page.', true);
  }
});

el('touchList')?.addEventListener('click', async (event) => {
  const del = event.target.closest('[data-del-touch]');
  if (!del) return;
  if (!confirm('Delete this journey page?')) return;
  await api(`/touchpoints/${del.dataset.delTouch}`, { method: 'DELETE' }).catch(() => null);
  state.touchpoints = state.touchpoints.filter((t) => t.id !== del.dataset.delTouch);
  renderTouchpoints();
  toast('Deleted.');
});

/* -------------------------------------------------------------------------- */
/* signs                                                                      */
/* -------------------------------------------------------------------------- */

function qrAuth(path) {
  return `/api/admin${path}?token=${encodeURIComponent(token)}`;
}

async function copyQrPng(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch');
    const blob = await res.blob();
    if (!navigator.clipboard?.write || !window.ClipboardItem) throw new Error('clipboard');
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    toast('QR copied as PNG.');
  } catch {
    toast('Couldn’t copy that QR.', true);
  }
}

function renderSigns() {
  const venue = locationSlug();
  const stations = (state.touchpoints || []).filter((t) => t.published);
  el('baseUrlSample').textContent = `${location.origin}/${venue}/cascade`;
  const stationCards = stations.map((tp) => {
    const svg = qrAuth(`/station-qr/${tp.id}.svg`);
    const png = qrAuth(`/station-qr/${tp.id}.png`);
    return `
    <div class="signCard">
      <div class="signCard__qr">
        <img src="${escapeHtml(svg)}" alt="QR for ${escapeHtml(tp.title)}">
      </div>
      <p class="signCard__name">${escapeHtml(tp.title)}</p>
      <p class="signCard__code">/${escapeHtml(venue)}/${escapeHtml(tp.slug)}</p>
      <div class="signCard__actions">
        <a class="ghostButton" href="${escapeHtml(svg)}" download="${escapeHtml(tp.slug)}-qr.svg">SVG</a>
        <a class="ghostButton" href="${escapeHtml(png)}" download="${escapeHtml(tp.slug)}-qr.png">PNG</a>
        <button class="ghostButton" type="button" data-copy-qr="${escapeHtml(png)}">Copy PNG</button>
      </div>
    </div>`;
  }).join('');
  el('signGrid').innerHTML = stationCards || `<p class="pane__note">No published quest stations yet.</p>`;
}

el('signGrid')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy-qr]');
  if (!button) return;
  copyQrPng(button.dataset.copyQr);
});

el('qrPngCopy')?.addEventListener('click', () => {
  const url = el('qrPngCopy').dataset.copyQr;
  if (url) copyQrPng(url);
});

el('printSheet').addEventListener('click', () => {
  const q = adventureId() ? `adventure_id=${encodeURIComponent(adventureId())}&` : '';
  window.open(`/api/admin/station-sheet?${q}token=${encodeURIComponent(token)}`, '_blank', 'noopener');
});

/* -------------------------------------------------------------------------- */
/* settings + stats                                                           */
/* -------------------------------------------------------------------------- */

function fillSettings() {
  const form = el('settingsForm');
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? '';
  });
}

el('settingsForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!adventureId()) return toast('Pick an adventure first.', true);
  const form = event.target;
  const payload = { adventure_id: adventureId() };
  [...form.elements].forEach((input) => {
    if (input.name) payload[input.name] = input.value;
  });
  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify(payload) });
    rebuildGrid();
    flashSaved();
    toast('Settings saved. Reload the map tab if artwork changed.');
  } catch {
    toast('Couldn’t save settings.', true);
  }
});

async function loadStats() {
  try {
    const q = adventureId() ? `?adventure_id=${encodeURIComponent(adventureId())}` : '';
    stats = await api(`/stats${q}`);
    const busiest = stats.perPoi[0];
    el('statRow').innerHTML = `
      <div class="stat"><span class="stat__n">${stats.guests}</span><span class="stat__l">Guests</span></div>
      <div class="stat"><span class="stat__n">${stats.scans}</span><span class="stat__l">Total scans</span></div>
      <div class="stat"><span class="stat__n">${stats.perHunt.reduce((sum, h) => sum + h.completions, 0)}</span><span class="stat__l">Rewards earned</span></div>
      <div class="stat"><span class="stat__n" style="font-size:16px;line-height:1.3">${escapeHtml(busiest?.name || '—')}</span><span class="stat__l">Most scanned</span></div>`;
    renderTable();
  } catch { /* stats are a nice-to-have */ }
}

function fillAdventureSelects() {
  const locations = state.tree || [];
  const locSelect = el('locationSelect');
  const advSelect = el('adventureSelect');
  if (!locSelect || !advSelect) return;

  const currentLocId = state.adventure?.location_id || locations[0]?.id;
  locSelect.innerHTML = locations.map((loc) =>
    `<option value="${escapeHtml(loc.id)}"${loc.id === currentLocId ? ' selected' : ''}>${escapeHtml(loc.name)} (${escapeHtml(loc.slug)})</option>`
  ).join('');

  const location = locations.find((l) => l.id === (locSelect.value || currentLocId)) || locations[0];
  const adventures = location?.adventures || [];
  const currentAdvId = state.adventure?.id || adventures.find((a) => a.is_active)?.id || adventures[0]?.id;
  advSelect.innerHTML = adventures.map((adv) =>
    `<option value="${escapeHtml(adv.id)}"${adv.id === currentAdvId ? ' selected' : ''}>${escapeHtml(String(adv.year))} — ${escapeHtml(adv.name)}${adv.is_active ? ' ●' : ''}</option>`
  ).join('');

  const link = el('guestAppLink');
  if (link) link.href = `/${locationSlug()}`;
}

async function loadAdventure(id) {
  if (!id) return;
  const data = await api(`/state?adventure_id=${encodeURIComponent(id)}`);
  state = {
    ...state,
    ...data,
    tree: data.tree || state.tree,
    adventure: data.adventure,
  };
  if (state.adventure?.id) sessionStorage.setItem('ic.admin.adventure', state.adventure.id);
  selectedId = null;
  fillAdventureSelects();
  fillSettings();
  renderHunts();
  renderTable();
  renderTouchpoints();
  if (map) {
    map.eachLayer((layer) => {
      if (layer instanceof L.ImageOverlay) map.removeLayer(layer);
    });
    const { width, height } = mapDims();
    const bounds = L.latLngBounds(toLatLng(0, height), toLatLng(width, 0));
    mapOverlay = L.imageOverlay(state.settings.map_image_url || '/assets/park-map.webp', bounds).addTo(map);
    map.setMaxBounds(bounds.pad(0.25));
    map.fitBounds(bounds);
    rebuildGrid();
    renderMarkers();
    select(null);
    setTimeout(() => map.invalidateSize(), 60);
  }
  loadStats();
}

el('locationSelect').addEventListener('change', async () => {
  const loc = (state.tree || []).find((l) => l.id === el('locationSelect').value);
  const next = loc?.adventures?.find((a) => a.is_active) || loc?.adventures?.[0];
  if (next) await loadAdventure(next.id);
  else fillAdventureSelects();
});

el('adventureSelect').addEventListener('change', async () => {
  await loadAdventure(el('adventureSelect').value);
});

el('activateAdventure').addEventListener('click', async () => {
  if (!adventureId()) return;
  try {
    state.adventure = await api(`/adventures/${adventureId()}/activate`, { method: 'POST' });
    const tree = await api('/tree');
    state.tree = tree.locations;
    fillAdventureSelects();
    toast('This adventure is now live for its short URL.');
  } catch {
    toast('Couldn’t activate that adventure.', true);
  }
});

el('newAdventure').addEventListener('click', async () => {
  const locId = el('locationSelect')?.value || state.adventure?.location_id;
  if (!locId) return toast('Create a location first.', true);
  const year = Number(prompt('Year for the new adventure?', String(new Date().getFullYear() + 1)));
  if (!Number.isFinite(year)) return;
  try {
    const adventure = await api(`/locations/${locId}/adventures`, {
      method: 'POST',
      body: JSON.stringify({
        year,
        name: `${year} Adventure`,
        is_active: false,
        map_image_url: state.settings.map_image_url,
        map_width: state.settings.map_width,
        map_height: state.settings.map_height,
        welcome_headline: state.settings.welcome_headline,
        welcome_body: state.settings.welcome_body,
        hours_note: state.settings.hours_note,
        safety_note: state.settings.safety_note,
      }),
    });
    const tree = await api('/tree');
    state.tree = tree.locations;
    await loadAdventure(adventure.id);
    toast(`Created ${year} adventure. Build the map, then Set active when ready.`);
  } catch {
    toast('Couldn’t create that year (it may already exist).', true);
  }
});

/* -------------------------------------------------------------------------- */
/* boot                                                                       */
/* -------------------------------------------------------------------------- */

async function start() {
  const preferred = sessionStorage.getItem('ic.admin.adventure') || '';
  const q = preferred ? `?adventure_id=${encodeURIComponent(preferred)}` : '';
  const data = await api(`/state${q}`);
  state = { settings: {}, pois: [], hunts: [], touchpoints: [], tree: [], adventure: null, ...data };
  if (state.adventure?.id) sessionStorage.setItem('ic.admin.adventure', state.adventure.id);

  el('gate').hidden = true;
  el('shell').hidden = false;

  fillAdventureSelects();
  if (!map) initMap();
  renderMarkers();
  renderTable();
  renderHunts();
  renderTouchpoints();
  fillSettings();
  loadStats();
  setTimeout(() => map && map.invalidateSize(), 80);
}

if (token) {
  start().catch(() => signOut());
} else {
  el('gate').hidden = false;
}
