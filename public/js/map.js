/* global L, window */
/**
 * The park map.
 *
 * We use Leaflet with CRS.Simple, which means coordinates are plain map-image
 * pixels rather than lat/lng. A marker stored at x=1420 y=1060 sits on that
 * pixel of the artwork at every zoom level. Drop in new artwork with the same
 * aspect ratio and every pin stays where it belongs.
 *
 * Leaflet is used for what it is genuinely good at — pinch zoom, inertia,
 * bounds clamping — while every marker is a plain DOM element we style and
 * animate ourselves, so the pins never look like default map pins.
 */
const ParkMap = (() => {
  const CATEGORY_COLORS = {
    landmark: 'var(--cat-landmark)',
    sculpture: 'var(--cat-sculpture)',
    lantern: 'var(--cat-lantern)',
    'photo-op': 'var(--cat-photo-op)',
    ride: 'var(--cat-ride)',
    amenity: 'var(--cat-amenity)',
  };

  const colorFor = (category) => CATEGORY_COLORS[category] || 'var(--cat-landmark)';

  let map = null;
  let bounds = null;
  let markers = new Map(); // poiId -> L.Marker
  let onSelect = () => {};
  let selectedId = null;
  let dims = { width: 2000, height: 1400 };

  /** Convert stored pixel coords to Leaflet's y-up CRS.Simple space. */
  const toLatLng = (x, y) => L.latLng(dims.height - y, x);

  function init(container, mapConfig, handlers = {}) {
    dims = { width: mapConfig.width, height: mapConfig.height };
    onSelect = handlers.onSelect || onSelect;

    map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 2,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 140,
      attributionControl: false,
      zoomControl: false,
      // Rubber-band drag past the edge feels broken on a park map; clamp hard.
      maxBoundsViscosity: 0.9,
      tap: true,
      bounceAtZoomLimits: false,
      zoomAnimation: true,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    bounds = L.latLngBounds(toLatLng(0, dims.height), toLatLng(dims.width, 0));
    L.imageOverlay(mapConfig.imageUrl, bounds, { interactive: false }).addTo(map);
    map.setMaxBounds(bounds.pad(0.12));
    fit();

    // Labels only appear once you're zoomed in enough for them not to collide.
    const syncZoomClass = () => {
      container.classList.toggle('zoomed-in', map.getZoom() > -1.2);
    };
    map.on('zoomend', syncZoomClass);
    syncZoomClass();

    // Pause decorative CSS animations while the map is moving so the main
    // thread isn't also running halo/aurora keyframes during pan/zoom.
    map.on('movestart zoomstart', () => document.body.classList.add('map-moving'));
    map.on('moveend zoomend', () => document.body.classList.remove('map-moving'));

    map.on('click', () => onSelect(null));
    return map;
  }

  function fit() {
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: [10, 10], animate: false });
    // Leave room for the bottom nav so the park isn't hidden behind it.
    map.panBy([0, -28], { animate: false });
  }

  function buildIcon(poi, { visited, isTarget, isGlow, isDimmed, label }) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.style.setProperty('--pin-color', colorFor(poi.category));
    if (visited) el.classList.add('is-visited');
    if (isTarget) el.classList.add('is-target');
    if (isGlow) el.classList.add('is-glow');
    if (isDimmed) el.classList.add('is-dimmed');
    el.innerHTML = `
      <span class="pin__halo"></span>
      <span class="pin__gem"></span>
      <span class="pin__tick"><svg viewBox="0 0 24 24"><path d="M5 13l4.5 4.5L19 7"/></svg></span>
      <span class="pin__label"></span>`;
    el.querySelector('.pin__label').textContent = label;
    return L.divIcon({ html: el.outerHTML, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
  }

  /**
   * Re-render all markers.
   * journeyOnly + journeyIds: when journey mode is on, hide amenity/guide pins
   * that aren't part of an active trail so guests can focus the game loop.
   */
  function render(pois, {
    scanned, targets, hidden, journeyOnly = false, journeyIds = null,
    completed = null, glowing = null,
  }) {
    if (!map) return;
    markers.forEach((m) => map.removeLayer(m));
    markers = new Map();

    const journeySet = journeyIds instanceof Set ? journeyIds : null;
    const completedSet = completed instanceof Set ? completed : new Set();
    const glowingSet = glowing instanceof Set ? glowing : new Set();

    pois
      .filter((p) => !hidden.has(p.category))
      .filter((p) => !journeyOnly || !journeySet || journeySet.has(p.id))
      .forEach((poi) => {
        const visited = scanned.has(poi.id);
        const isTarget = targets.has(poi.id);
        const isGlow = glowingSet.has(poi.id);
        const isDimmed = completedSet.has(poi.id);
        const marker = L.marker(toLatLng(poi.x, poi.y), {
          icon: buildIcon(poi, { visited, isTarget, isGlow, isDimmed, label: poi.name }),
          keyboard: true,
          title: poi.name,
          riseOnHover: true,
          zIndexOffset: isGlow ? 500 : isTarget ? 400 : isDimmed ? 80 : visited ? 100 : 200,
        }).addTo(map);

        marker.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          onSelect(poi.id);
        });
        markers.set(poi.id, marker);
      });

    if (selectedId) highlight(selectedId);
  }

  function highlight(poiId) {
    selectedId = poiId;
    markers.forEach((marker, id) => {
      const el = marker.getElement()?.querySelector('.pin');
      if (el) el.classList.toggle('is-selected', id === poiId);
    });
  }

  /** Centre a marker in the visible strip above the sheet. */
  function focusOn(poiId, pois, { zoom = 0.25, offsetY = 0.22 } = {}) {
    const poi = pois.find((p) => p.id === poiId);
    if (!poi || !map) return;
    const target = toLatLng(poi.x, poi.y);
    const nextZoom = Math.max(map.getZoom(), zoom);
    const point = map.project(target, nextZoom).subtract([0, -map.getSize().y * offsetY]);
    map.flyTo(map.unproject(point, nextZoom), nextZoom, { duration: 0.8 });
    highlight(poiId);
  }

  /** A quick shimmer on a marker the moment its code is scanned. */
  function celebrate(poiId) {
    const el = markers.get(poiId)?.getElement()?.querySelector('.pin');
    if (!el) return;
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(2.1)' },
        { transform: 'scale(1.4)' },
        { transform: 'scale(1.5)' },
      ],
      { duration: 900, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    );
  }

  const invalidate = () => map && map.invalidateSize();
  const getMap = () => map;

  return { init, render, fit, focusOn, highlight, celebrate, invalidate, getMap, colorFor, CATEGORY_COLORS };
})();

window.ParkMap = ParkMap;
