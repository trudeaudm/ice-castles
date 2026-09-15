/* global window, localStorage, fetch */
/**
 * Store + API client.
 * Device token in localStorage. Same-day quest session lives on the server.
 */
const Store = (() => {
  const KEY_GUEST = 'ic.guest.v1';
  const KEY_CACHE = 'ic.cache.v1';
  const KEY_QUEUE = 'ic.queue.v1';
  const KEY_SEEN = 'ic.seen.v1';
  const KEY_JOURNEY = 'ic.journey.v1';
  const KEY_INTENDED = 'ic.intended.v1';

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* private mode */ }
  };

  function pathContext() {
    const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const reserved = new Set(['admin', 'api', 'assets', 'vendor', 'js', 's']);
    if (!parts.length || reserved.has(parts[0].toLowerCase())) {
      return { venueCode: null, locationSlug: null, year: null, station: null };
    }
    const first = parts[0];
    const second = parts[1] || null;
    if (second && /^\d{4}$/.test(second)) {
      return { venueCode: first.toLowerCase(), locationSlug: first, year: Number(second), station: null };
    }
    return {
      venueCode: first.toLowerCase(),
      locationSlug: first,
      year: null,
      station: second || null,
    };
  }

  const state = {
    adventure: null,
    park: null,
    map: null,
    pois: [],
    hunts: [],
    touchpoints: [],
    session: null,
    operatingDate: null,
    progress: { scans: [], tokens: [], completions: [] },
    hiddenCategories: new Set(read(KEY_SEEN, {}).hidden || []),
    journeyMode: Boolean(read(KEY_JOURNEY, false)),
    online: navigator.onLine,
    loadedFromCache: false,
    path: pathContext(),
  };

  const listeners = new Set();
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => fn(state));

  const guestToken = () => read(KEY_GUEST, null);
  const setGuestToken = (token) => write(KEY_GUEST, token);

  function bootstrapQuery() {
    const { venueCode, locationSlug, year } = state.path;
    const params = new URLSearchParams();
    if (venueCode) params.set('venue', venueCode);
    else if (locationSlug) params.set('location', locationSlug);
    if (year) params.set('year', String(year));
    const q = params.toString();
    return q ? `?${q}` : '';
  }

  function cacheKey() {
    const { venueCode, year } = state.path;
    return `${KEY_CACHE}:${venueCode || 'default'}:${year || 'active'}`;
  }

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = guestToken();
    if (token) headers['x-guest-token'] = token;
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || `http_${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json();
  }

  function applyBootstrap(data) {
    state.adventure = data.adventure || null;
    state.park = data.park;
    state.map = data.map;
    state.pois = data.pois;
    state.hunts = data.hunts;
    state.touchpoints = data.touchpoints || [];
    state.session = data.session || null;
    state.operatingDate = data.operatingDate || null;
    state.progress = data.progress || { scans: [], tokens: [], completions: [] };
    if (data.guest?.token) setGuestToken(data.guest.token);
    write(cacheKey(), data);

    const venue = state.adventure?.venueCode;
    if (venue && state.path.venueCode && state.path.venueCode !== venue) {
      const station = state.path.station ? `/${state.path.station}` : '';
      history.replaceState(null, '', `/${venue}${station}${location.hash || ''}`);
      state.path = pathContext();
    }
  }

  function applyQuest(data) {
    if (data.guestToken) setGuestToken(data.guestToken);
    if (data.session !== undefined) state.session = data.session;
    if (data.touchpoints) state.touchpoints = data.touchpoints;
    emit();
  }

  async function load() {
    state.path = pathContext();
    try {
      const data = await request(`/api/bootstrap${bootstrapQuery()}`);
      applyBootstrap(data);
      state.online = true;
      state.loadedFromCache = false;
    } catch (err) {
      const cached = read(cacheKey(), null) || read(KEY_CACHE, null);
      if (!cached) throw err;
      applyBootstrap(cached);
      state.online = false;
      state.loadedFromCache = true;
    }
    emit();
    return state;
  }

  const scannedIds = () => new Set(state.progress.scans.map((s) => s.poiId));
  const tokenIds = () => new Set(state.progress.tokens.map((t) => t.stopId));

  function huntProgress(hunt) {
    const earned = tokenIds();
    const found = hunt.stops.filter((s) => earned.has(s.id)).length;
    const total = hunt.stops.length;
    const done = state.progress.completions.some((c) => c.huntId === hunt.id);
    const completion = state.progress.completions.find((c) => c.huntId === hunt.id);
    return { found, total, done, redeemCode: completion?.redeemCode || null };
  }

  const stopsForPoi = (poiId) =>
    state.hunts.flatMap((h) =>
      h.stops.filter((s) => s.poiId === poiId).map((s) => ({ ...s, hunt: h }))
    );

  const poiBySlug = (slug) => state.pois.find((p) => p.slug === slug) || null;
  const poiById = (id) => state.pois.find((p) => p.id === id) || null;
  const stopById = (id) =>
    state.hunts.flatMap((h) => h.stops).find((s) => s.id === id) || null;
  const touchBySlug = (slug) => state.touchpoints.find((t) => t.slug === slug) || null;
  const touchByType = (type) => state.touchpoints.filter((t) => t.type === type);
  const touchForPoi = (poiId) => state.touchpoints.find((t) => t.poiId === poiId) || null;

  const hasLiveSession = () => Boolean(state.session?.live);
  const realmsAwakened = () => (state.session?.realms || []).filter((r) => r.complete).length;

  function intendedStation() {
    return state.path.station || read(KEY_INTENDED, null);
  }
  function setIntendedStation(slug) {
    write(KEY_INTENDED, slug || null);
  }

  function stationPath(slug) {
    const venue = state.adventure?.venueCode || state.path.venueCode || 'nh';
    return slug ? `/${venue}/${slug}` : `/${venue}`;
  }

  async function startSession(station) {
    const data = await request(`/api/quest/session${bootstrapQuery()}`, {
      method: 'POST',
      body: JSON.stringify({ station: station || intendedStation() }),
    });
    applyQuest(data);
    return data;
  }

  async function visitStation(station) {
    const data = await request(`/api/quest/visit${bootstrapQuery()}`, {
      method: 'POST',
      body: JSON.stringify({ station }),
    });
    applyQuest(data);
    return data;
  }

  async function completeStation(station, answer) {
    try {
      const data = await request(`/api/quest/challenge${bootstrapQuery()}`, {
        method: 'POST',
        body: JSON.stringify({ station, answer }),
      });
      applyQuest(data);
      return { status: data.alreadyCompleted ? 'repeat' : 'new', ...data };
    } catch (err) {
      return { status: 'error', error: err.body?.error || err.message, remaining: err.body?.remaining };
    }
  }

  async function scanHeart() {
    try {
      const data = await request(`/api/quest/heart${bootstrapQuery()}`, { method: 'POST', body: '{}' });
      applyQuest(data);
      return data;
    } catch (err) {
      return { error: err.body?.error || err.message, remaining: err.body?.remaining };
    }
  }

  async function finishQuest(payload) {
    const data = await request(`/api/quest/complete${bootstrapQuery()}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    applyQuest(data);
    return data;
  }

  function journeyComplete() {
    return Boolean(state.session?.winterKeeper);
  }

  function journeyPoiIds() {
    return new Set(
      state.touchpoints.filter((t) => t.poiId).map((t) => t.poiId)
    );
  }

  function guardianPoiIds() {
    return new Set(
      state.touchpoints.filter((t) => t.type === 'guardian' && t.poiId).map((t) => t.poiId)
    );
  }

  function completedGuardianPoiIds() {
    return new Set(
      state.touchpoints
        .filter((t) => t.type === 'guardian' && t.complete && t.poiId)
        .map((t) => t.poiId)
    );
  }

  function totals() {
    const awakened = realmsAwakened();
    return {
      tokens: awakened,
      tokensTotal: 5,
      visited: scannedIds().size,
      visitedTotal: state.pois.length,
      rewards: state.session?.winterKeeper ? 1 : 0,
    };
  }

  const queue = () => read(KEY_QUEUE, []);
  const setQueue = (items) => write(KEY_QUEUE, items);

  async function scan(code) {
    const cleanCode = String(code).trim().toUpperCase().replace(/^.*\/S\//, '');
    if (!cleanCode) return { status: 'invalid' };
    try {
      const data = await request('/api/scan', {
        method: 'POST',
        body: JSON.stringify({ code: cleanCode }),
      });
      if (data.guestToken) setGuestToken(data.guestToken);
      state.progress = data.progress;
      state.online = true;
      emit();
      return {
        status: data.alreadyScanned ? 'repeat' : 'new',
        poi: data.poi,
        awards: data.awards,
        completed: data.completed,
      };
    } catch (err) {
      if (err.status === 404) return { status: 'unknown', code: cleanCode };
      const pending = queue();
      if (!pending.includes(cleanCode)) {
        pending.push(cleanCode);
        setQueue(pending);
      }
      state.online = false;
      emit();
      return { status: 'queued', code: cleanCode, queued: pending.length };
    }
  }

  async function completeChallenge(stopId, answer) {
    try {
      const data = await request('/api/challenge', {
        method: 'POST',
        body: JSON.stringify({ stopId, answer }),
      });
      if (data.guestToken) setGuestToken(data.guestToken);
      state.progress = data.progress;
      emit();
      return {
        status: data.alreadyCompleted ? 'repeat' : 'new',
        poi: data.poi,
        awards: data.awards,
        completed: data.completed,
      };
    } catch (err) {
      return { status: 'error', error: err.body?.error || err.message };
    }
  }

  async function flushQueue() {
    const pending = queue();
    if (!pending.length) return [];
    const results = [];
    const stillPending = [];
    for (const code of pending) {
      try {
        const data = await request('/api/scan', { method: 'POST', body: JSON.stringify({ code }) });
        state.progress = data.progress;
        if (!data.alreadyScanned) {
          results.push({ poi: data.poi, awards: data.awards, completed: data.completed });
        }
      } catch (err) {
        if (err.status !== 404) stillPending.push(code);
      }
    }
    setQueue(stillPending);
    if (results.length) emit();
    return results;
  }

  async function refreshProgress() {
    try {
      state.progress = await request(`/api/progress${bootstrapQuery()}`);
      emit();
    } catch { /* keep cached */ }
  }

  async function resetGuest() {
    try {
      const data = await request('/api/guest', { method: 'POST' });
      setGuestToken(data.token);
    } catch {
      localStorage.removeItem(KEY_GUEST);
    }
    setQueue([]);
    state.session = null;
    state.progress = { scans: [], tokens: [], completions: [] };
    emit();
  }

  function toggleCategory(category) {
    if (state.hiddenCategories.has(category)) state.hiddenCategories.delete(category);
    else state.hiddenCategories.add(category);
    write(KEY_SEEN, { hidden: [...state.hiddenCategories] });
    emit();
  }

  function setJourneyMode(on) {
    state.journeyMode = Boolean(on);
    write(KEY_JOURNEY, state.journeyMode);
    emit();
  }

  function toggleJourneyMode() {
    setJourneyMode(!state.journeyMode);
    return state.journeyMode;
  }

  window.addEventListener('online', () => { state.online = true; emit(); });
  window.addEventListener('offline', () => { state.online = false; emit(); });

  return {
    state, subscribe, load, scan, completeChallenge, flushQueue, refreshProgress, resetGuest,
    scannedIds, tokenIds, huntProgress, stopsForPoi, poiBySlug, poiById, stopById,
    touchBySlug, touchByType, touchForPoi, journeyComplete, journeyPoiIds,
    guardianPoiIds, completedGuardianPoiIds, totals,
    toggleCategory, setJourneyMode, toggleJourneyMode, queue, pathContext,
    hasLiveSession, realmsAwakened, intendedStation, setIntendedStation, stationPath,
    startSession, visitStation, completeStation, scanHeart, finishQuest,
  };
})();

window.Store = Store;
