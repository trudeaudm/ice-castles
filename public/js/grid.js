/**
 * Reference grid — an authoring aid, not a guest feature.
 *
 * The park map is a fixed-size image (default 2000x1400) and every POI is
 * stored in that image's pixel space. The grid draws 100px cells labelled
 * A–T across and 1–14 down, so a coordinate can be spoken out loud: "the
 * golem sits in E3". It is a separate Leaflet layer, so removing it from the
 * customer build is one line, and it is off by default for guests.
 *
 * Lines are polylines rather than a baked-in image so they stay hairline-thin
 * at every zoom level instead of getting chunky as you zoom in.
 */
(function (global) {
  const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /** Map image pixel (x, y from top-left) -> Leaflet LatLng for CRS.Simple. */
  function toLatLng(L, x, y, height) {
    return L.latLng(height - y, x);
  }

  /** Leaflet LatLng -> map image pixel, rounded to whole pixels. */
  function fromLatLng(latlng, height) {
    return { x: Math.round(latlng.lng), y: Math.round(height - latlng.lat) };
  }

  /** "F7"-style label for a pixel coordinate. */
  function cellFor(x, y, cell = 100) {
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell) + 1;
    const letter =
      col < COLS.length
        ? COLS[col]
        : COLS[Math.floor(col / COLS.length) - 1] + COLS[col % COLS.length];
    return `${letter}${row}`;
  }

  function createGridLayer(L, opts = {}) {
    const width = opts.width || 2000;
    const height = opts.height || 1400;
    const cell = opts.cell || 100;
    const group = L.layerGroup();

    const line = (a, b, major) =>
      L.polyline([a, b], {
        color: major ? '#8fe8ff' : '#8fe8ff',
        weight: major ? 1.6 : 0.8,
        opacity: major ? 0.5 : 0.22,
        interactive: false,
        dashArray: major ? null : '3 6',
      });

    // vertical lines
    for (let x = 0; x <= width; x += cell) {
      const major = (x / cell) % 5 === 0;
      line(toLatLng(L, x, 0, height), toLatLng(L, x, height, height), major).addTo(group);
    }
    // horizontal lines
    for (let y = 0; y <= height; y += cell) {
      const major = (y / cell) % 5 === 0;
      line(toLatLng(L, 0, y, height), toLatLng(L, width, y, height), major).addTo(group);
    }

    const label = (x, y, text, cls) =>
      L.marker(toLatLng(L, x, y, height), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: `grid-label ${cls}`,
          html: text,
          iconSize: [cell, 18],
          iconAnchor: [cell / 2, 9],
        }),
      });

    // column letters along the top, row numbers down the left
    for (let x = 0; x < width; x += cell) {
      label(x + cell / 2, 16, cellFor(x, 0, cell).replace(/\d+$/, ''), 'grid-label--col').addTo(group);
    }
    for (let y = 0; y < height; y += cell) {
      label(22, y + cell / 2, String(y / cell + 1), 'grid-label--row').addTo(group);
    }

    group.gridMeta = { width, height, cell };
    return group;
  }

  global.ParkGrid = { createGridLayer, cellFor, toLatLng, fromLatLng };
})(window);
