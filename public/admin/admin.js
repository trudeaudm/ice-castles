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
let state = { settings: {}, pois: [], hunts: [] };
let stats = { perPoi: [], perHunt: [], guests: 0, scans: 0 };
let selectedId = null;
let map = null;
let markers = new Map();

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
const cellRef = (x, y) => ParkGrid.cellFor(x, y, gridCell());

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
  if (!gridLayer || !map) return;
  if (gridOn) gridLayer.addTo(map);
  else map.removeLayer(gridLayer);
  updateGridButton();
}

function rebuildGrid() {
  if (!map) return;
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
  L.imageOverlay(state.settings.map_image_url || '/assets/park-map.svg', bounds).addTo(map);
  map.setMaxBounds(bounds.pad(0.25));
  map.fitBounds(bounds);

  // Reference grid. This is a working layer only: it lives on the admin map so
  // positions can be talked about out loud ("the golem is in E3") while the
  // real artwork is still being drawn from overhead photos. It is a plain
  // Leaflet layer, so it is never part of what a guest loads.
  gridLayer = ParkGrid.createGridLayer(L, { width, height, cell: gridCell() });
  if (gridOn) gridLayer.addTo(map);
  updateGridButton();

  // Clicking open ground creates a marker right there. This is the fastest
  // possible path from "we added a sculpture" to "it's on the guest map".
  map.on('click', async (event) => {
    const { x, y } = fromLatLng(event.latlng);
    try {
      const poi = await api('/pois', {
        method: 'POST',
        body: JSON.stringify({ name: 'New marker', x, y, published: false }),
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
  el('qrLink').href = `/api/admin/qr/${poi.id}.svg?token=${encodeURIComponent(token)}`;
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
  try {
    const poi = await api('/pois', {
      method: 'POST',
      body: JSON.stringify({ name: 'New marker', x: Math.round(width / 2), y: Math.round(height / 2), published: false }),
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
      return `
        <div class="stopRow" data-stop="${escapeHtml(stop.id)}">
          <span class="stopRow__glyph">${GLYPH_CHARS[stop.token_glyph] || '❄️'}</span>
          <div class="stopRow__body">
            <p class="stopRow__name">${escapeHtml(poi ? poi.name : 'Missing marker')}</p>
            <p class="stopRow__hint">${escapeHtml(stop.token_name)}</p>
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
  try {
    const hunt = await api('/hunts', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New trail',
        tagline: 'Find them all.',
        reward_title: 'Reward unlocked',
        reward_body: 'Show this screen at the Warming Hut to claim it.',
        active: false,
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

/** Inline editor for a stop: what the token is called, its glyph, and the hint. */
function openStopEditor(stopId) {
  const hunt = state.hunts.find((h) => h.stops.some((s) => s.id === stopId));
  const stop = hunt.stops.find((s) => s.id === stopId);
  const row = el('huntList').querySelector(`[data-stop="${stopId}"]`);

  row.innerHTML = `
    <div style="flex:1;display:grid;gap:8px">
      <input data-field="token_name" value="${escapeHtml(stop.token_name)}" placeholder="Token name" maxlength="80">
      <input data-field="hint" value="${escapeHtml(stop.hint || '')}" placeholder="Hint guests see before they find it" maxlength="400">
      <select data-field="token_glyph">
        ${GLYPHS.map((g) => `<option value="${g}"${g === stop.token_glyph ? ' selected' : ''}>${GLYPH_CHARS[g]} ${g}</option>`).join('')}
      </select>
      <div style="display:flex;gap:7px">
        <button class="primaryButton" data-save-stop="${escapeHtml(stopId)}" type="button">Save stop</button>
        <button class="iconButton" data-cancel-stop type="button">Cancel</button>
      </div>
    </div>`;

  row.querySelector('[data-cancel-stop]').addEventListener('click', renderHunts);
  row.querySelector('[data-save-stop]').addEventListener('click', async () => {
    const payload = {};
    row.querySelectorAll('[data-field]').forEach((input) => { payload[input.dataset.field] = input.value; });
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
/* signs                                                                      */
/* -------------------------------------------------------------------------- */

function renderSigns() {
  const live = state.pois.filter((poi) => poi.published && poi.scan_code);
  el('baseUrlSample').textContent = `${location.origin}/s/CODE`;
  el('signGrid').innerHTML = live.length
    ? live.map((poi) => `
        <div class="signCard">
          <div class="signCard__qr">
            <img src="/api/admin/qr/${escapeHtml(poi.id)}.svg?token=${encodeURIComponent(token)}" alt="QR code for ${escapeHtml(poi.name)}">
          </div>
          <p class="signCard__name">${escapeHtml(poi.name)}</p>
          <p class="signCard__code">${escapeHtml(poi.scan_code)}</p>
          <a class="ghostButton" href="/api/admin/qr/${escapeHtml(poi.id)}.svg?token=${encodeURIComponent(token)}"
             download="${escapeHtml(poi.slug)}-qr.svg">Download SVG</a>
        </div>`).join('')
    : `<p class="pane__note">No live markers yet. Turn a marker on and its sign appears here.</p>`;
}

el('printSheet').addEventListener('click', () => {
  window.open(`/api/admin/qr-sheet?token=${encodeURIComponent(token)}`, '_blank', 'noopener');
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
  const form = event.target;
  const payload = {};
  [...form.elements].forEach((input) => {
    if (input.name) payload[input.name] = input.value;
  });
  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify(payload) });
    rebuildGrid();
    flashSaved();
    toast('Settings saved. Reload to see new map artwork.');
  } catch {
    toast('Couldn’t save settings.', true);
  }
});

async function loadStats() {
  try {
    stats = await api('/stats');
    const busiest = stats.perPoi[0];
    el('statRow').innerHTML = `
      <div class="stat"><span class="stat__n">${stats.guests}</span><span class="stat__l">Guests</span></div>
      <div class="stat"><span class="stat__n">${stats.scans}</span><span class="stat__l">Total scans</span></div>
      <div class="stat"><span class="stat__n">${stats.perHunt.reduce((sum, h) => sum + h.completions, 0)}</span><span class="stat__l">Rewards earned</span></div>
      <div class="stat"><span class="stat__n" style="font-size:16px;line-height:1.3">${escapeHtml(busiest?.name || '—')}</span><span class="stat__l">Most scanned</span></div>`;
    renderTable();
  } catch { /* stats are a nice-to-have; never block the dashboard on them */ }
}

/* -------------------------------------------------------------------------- */
/* boot                                                                       */
/* -------------------------------------------------------------------------- */

async function start() {
  state = await api('/state');
  el('gate').hidden = true;
  el('shell').hidden = false;

  if (!map) initMap();
  renderMarkers();
  renderTable();
  renderHunts();
  fillSettings();
  loadStats();
  setTimeout(() => map.invalidateSize(), 80);
}

if (token) {
  start().catch(() => signOut());
} else {
  el('gate').hidden = false;
}
