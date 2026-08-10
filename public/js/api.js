/* global window, localStorage, fetch */
/**
 * Store + API client.
 *
 * Identity: a single opaque guest token in localStorage. Progress is scoped
 * server-side to the adventure package currently loaded.
 */
const Store = (() => {
  const KEY_GUEST = 'ic.guest.v1';
  const KEY_CACHE = 'ic.cache.v1';
  const KEY_QUEUE = 'ic.queue.v1';
  const KEY_SEEN = 'ic.seen.v1';
  const KEY_JOURNEY = 'ic.journey.v1';

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
    } catch {
      /* private mode or full quota */
    }
  };

  /** Parse /NHAdventure or /NHAdventure/2026 from the URL. */
  function pathContext() {
    const parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const reserved = new Set(['admin', 'api', 'assets', 'vendor', 'js', 's']);
    if (!parts.length || reserved.has(parts[0].toLowerCase())) {
      return { locationSlug: null, year: null };
    }
    const locationSlug = parts[0];
    const year = parts[1] && /^\d{4}$/.test(parts[1]) ? Number(parts[1]) : null;
    return { locationSlug, year };
  }

  const state = {
    adventure: null,
    park: null,
    map: null,
    pois: [],
    hunts: [],
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
    const { locationSlug, year } = state.path;
    const params = new URLSearchParams();
    if (locationSlug) params.set('location', locationSlug);
    if (year) params.set('year', String(year));
    const q = params.toString();
    return q ? `?${q}` : '';
  }

  function cacheKey() {
    const { locationSlug, year } = state.path;
    return `${KEY_CACHE}:${locationSlug || 'default'}:${year || 'active'}`;
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
    state.progress = data.progress;
    if (data.guest?.token) setGuestToken(data.guest.token);
    write(cacheKey(), data);

    // Canonicalize short URL onto the location slug when we resolved a default.
    if (state.adventure?.locationSlug && !state.path.locationSlug) {
      const target = state.path.year
        ? `/${state.adventure.locationSlug}/${state.path.year}`
        : `/${state.adventure.locationSlug}`;
      if (location.pathname !== target) {
        history.replaceState(null, '', `${target}${location.hash || '#/map'}`);
        state.path = pathContext();
      }
    }
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

  /** POI ids that appear on any active trail (journey map focus). */
  function journeyPoiIds() {
    return new Set(state.hunts.flatMap((h) => h.stops.map((s) => s.poiId)));
  }

  function totals() {
    const earned = tokenIds();
    const allStops = state.hunts.flatMap((h) => h.stops);
    return {
      tokens: allStops.filter((s) => earned.has(s.id)).length,
      tokensTotal: allStops.length,
      visited: scannedIds().size,
      visitedTotal: state.pois.length,
      rewards: state.progress.completions.length,
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
      state.online = true;
      emit();
      return {
        status: data.alreadyCompleted ? 'repeat' : 'new',
        poi: data.poi,
        awards: data.awards,
        completed: data.completed,
        error: null,
      };
    } catch (err) {
      return {
        status: 'error',
        error: err.body?.error || err.message,
      };
    }
  }

  async function flushQueue() {
    const pending = queue();
    if (!pending.length) return [];
    const results = [];
    const stillPending = [];
    for (const code of pending) {
      try {
        const data = await request('/api/scan', {
          method: 'POST',
          body: JSON.stringify({ code }),
        });
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
    journeyPoiIds, totals, toggleCategory, setJourneyMode, toggleJourneyMode, queue, pathContext,
  };
})();

window.Store = Store;
