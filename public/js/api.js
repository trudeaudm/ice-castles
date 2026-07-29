/* global window, localStorage, fetch */
/**
 * Store + API client.
 *
 * Identity: a single opaque guest token in localStorage. No account, no email,
 * no personal data. The server keeps progress against that token so a guest
 * can close the tab, come back tomorrow night, and pick up where they left off.
 *
 * Scan codes are never sent to the client. That is deliberate — if the app knew
 * every code, a guest could collect the whole hunt from the parking lot. The
 * only way to earn a token is to physically reach the sign.
 */
const Store = (() => {
  const KEY_GUEST = 'ic.guest.v1';
  const KEY_CACHE = 'ic.cache.v1';
  const KEY_QUEUE = 'ic.queue.v1';
  const KEY_SEEN = 'ic.seen.v1';

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
      /* private mode or full quota — the app still works, just without memory */
    }
  };

  const state = {
    park: null,
    map: null,
    pois: [],
    hunts: [],
    progress: { scans: [], tokens: [], completions: [] },
    hiddenCategories: new Set(read(KEY_SEEN, {}).hidden || []),
    online: navigator.onLine,
    loadedFromCache: false,
  };

  const listeners = new Set();
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const emit = () => listeners.forEach((fn) => fn(state));

  const guestToken = () => read(KEY_GUEST, null);
  const setGuestToken = (token) => write(KEY_GUEST, token);

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
    state.park = data.park;
    state.map = data.map;
    state.pois = data.pois;
    state.hunts = data.hunts;
    state.progress = data.progress;
    if (data.guest?.token) setGuestToken(data.guest.token);
    write(KEY_CACHE, data);
  }

  async function load() {
    try {
      const data = await request('/api/bootstrap');
      applyBootstrap(data);
      state.online = true;
      state.loadedFromCache = false;
    } catch (err) {
      // Cell service in the park is unreliable. Fall back to whatever we
      // cached on the last good load so the map still works.
      const cached = read(KEY_CACHE, null);
      if (!cached) throw err;
      applyBootstrap(cached);
      state.online = false;
      state.loadedFromCache = true;
    }
    emit();
    return state;
  }

  /* ------------------------------ derived views --------------------------- */

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

  /** Every stop across all active hunts that maps to this POI. */
  const stopsForPoi = (poiId) =>
    state.hunts.flatMap((h) =>
      h.stops.filter((s) => s.poiId === poiId).map((s) => ({ ...s, hunt: h }))
    );

  const poiBySlug = (slug) => state.pois.find((p) => p.slug === slug) || null;
  const poiById = (id) => state.pois.find((p) => p.id === id) || null;

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

  /* -------------------------------- scanning ------------------------------ */

  const queue = () => read(KEY_QUEUE, []);
  const setQueue = (items) => write(KEY_QUEUE, items);

  /**
   * Resolve a code. When offline we can't verify it, so we park it in a queue
   * and replay it the moment we're back on the network — the guest keeps
   * walking instead of standing still waiting for a bar of signal.
   */
  async function scan(code) {
    const clean = String(code).trim().toUpperCase().replace(/^.*\/S\//, '');
    if (!clean) return { status: 'invalid' };

    try {
      const data = await request('/api/scan', {
        method: 'POST',
        body: JSON.stringify({ code: clean }),
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
      if (err.status === 404) return { status: 'unknown', code: clean };
      const pending = queue();
      if (!pending.includes(clean)) {
        pending.push(clean);
        setQueue(pending);
      }
      state.online = false;
      emit();
      return { status: 'queued', code: clean, queued: pending.length };
    }
  }

  /** Replay anything captured while offline. Returns everything earned. */
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
      state.progress = await request('/api/progress');
      emit();
    } catch { /* keep the cached copy */ }
  }

  async function resetGuest() {
    try {
      const data = await request('/api/guest', { method: 'POST' });
      setGuestToken(data.token);
    } catch { /* offline: clear locally and let the next load mint a token */
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

  window.addEventListener('online', () => { state.online = true; emit(); });
  window.addEventListener('offline', () => { state.online = false; emit(); });

  return {
    state, subscribe, load, scan, flushQueue, refreshProgress, resetGuest,
    scannedIds, tokenIds, huntProgress, stopsForPoi, poiBySlug, poiById,
    totals, toggleCategory, queue,
  };
})();

window.Store = Store;
