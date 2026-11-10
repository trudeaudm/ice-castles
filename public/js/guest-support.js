/* Shared guest helpers — usable from the browser and Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GuestSupport = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const OPERATING_TZ = 'America/New_York';
  const CUTOFF_HOUR = 4;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function zonedParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: OPERATING_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
  }

  function addCalendarDays(year, month, day, delta) {
    const dt = new Date(Date.UTC(year, month - 1, day + delta));
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
  }

  /** Same operating-day key the server uses (4 AM America/New_York cutoff). */
  function operatingDateKey(date = new Date()) {
    const p = zonedParts(date);
    const day = p.hour < CUTOFF_HOUR ? addCalendarDays(p.year, p.month, p.day, -1) : p;
    return `${day.year}-${pad(day.month)}-${pad(day.day)}`;
  }

  function isSnapshotFresh(snapshot, date = new Date()) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (!snapshot.guest?.token) return false;
    if (snapshot.operatingDate && snapshot.operatingDate !== operatingDateKey(date)) return false;
    if (snapshot.session?.live === false) return true;
    if (snapshot.session?.operatingDate && snapshot.session.operatingDate !== operatingDateKey(date)) {
      return false;
    }
    return true;
  }

  function normalizeQueueItem(item) {
    if (typeof item === 'string') {
      const code = item.trim().toUpperCase();
      return code ? { code, status: 'pending', queuedAt: 0 } : null;
    }
    if (!item || typeof item !== 'object') return null;
    const code = String(item.code || '').trim().toUpperCase();
    if (!code) return null;
    return {
      code,
      status: item.status === 'failed' ? 'failed' : 'pending',
      queuedAt: Number(item.queuedAt) || 0,
      lastError: item.lastError || null,
    };
  }

  /**
   * Parse a camera / manual QR payload into an amenity scan or station deep-link.
   * Station signs encode /{venue}/{slug}. Amenity markers encode /s/CODE.
   */
  function parseScanPayload(raw) {
    const text = String(raw || '').trim();
    if (!text) return { kind: 'invalid' };

    let path = text;
    let hash = '';
    try {
      if (/^https?:\/\//i.test(text)) {
        const url = new URL(text);
        path = `${url.pathname}${url.search || ''}`;
        hash = url.hash || '';
      }
    } catch { /* plain text */ }

    const hashScan = (hash || text).match(/#\/?scan\/([A-Za-z0-9-]+)/i);
    if (hashScan) {
      return { kind: 'amenity', code: hashScan[1].toUpperCase() };
    }

    const queryMatch = path.match(/[?&]scan=([A-Za-z0-9-]+)/i);
    if (queryMatch) {
      return { kind: 'amenity', code: queryMatch[1].toUpperCase() };
    }

    const amenity = path.match(/\/s\/([A-Za-z0-9-]+)/i);
    if (amenity) {
      return { kind: 'amenity', code: amenity[1].toUpperCase() };
    }

    const station = path.match(/^\/?([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/?$/i);
    if (station) {
      const venue = station[1].toLowerCase();
      const slug = station[2].toLowerCase();
      if (!['admin', 'api', 'assets', 'vendor', 'js', 's', 'maps'].includes(venue)) {
        return { kind: 'station', venue, slug };
      }
    }

    if (/^[A-Za-z0-9-]{4,14}$/.test(text)) {
      return { kind: 'amenity', code: text.toUpperCase() };
    }

    return { kind: 'invalid' };
  }

  function legacyHashScan(hash = '') {
    const match = String(hash || '').match(/^#\/?scan\/([A-Za-z0-9-]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  return {
    OPERATING_TZ,
    CUTOFF_HOUR,
    operatingDateKey,
    isSnapshotFresh,
    normalizeQueueItem,
    parseScanPayload,
    legacyHashScan,
  };
});
