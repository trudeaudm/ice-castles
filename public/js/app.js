/* global window, document, Store, ParkMap, Scanner */

(function applyGuestMotionFlag() {
  const on = Boolean(window.__CQ_FLAGS__?.reducedMotion);
  document.documentElement.classList.toggle('cq-motion-flag', on);
})();

const ART = '/assets/art';
const CATEGORY_LABELS = {
  landmark: 'Landmarks',
  sculpture: 'Sculptures',
  lantern: 'Lanterns',
  'photo-op': 'Photo spots',
  ride: 'Rides',
  amenity: 'Amenities',
};
const SHRINE_VIEW_KEY = 'ic.shrineView.v1';
const REALM_META = {
  water: { label: 'Water', glyph: '💧', character: `${ART}/char-cascade.png?v=1600`, pfp: `${ART}/pfp-cascade.png`, wave: `${ART}/wave-cascade.mp4?v=2` },
  earth: { label: 'Earth', glyph: '🪨', character: `${ART}/char-granite.png?v=1600`, pfp: `${ART}/pfp-granite.png`, wave: `${ART}/wave-granite.mp4?v=2` },
  fire: { label: 'Fire', glyph: '🔥', character: `${ART}/char-ember.png?v=1600`, pfp: `${ART}/pfp-ember.png`, wave: `${ART}/wave-ember.mp4?v=2` },
  air: { label: 'Air', glyph: '🌬️', character: `${ART}/char-summit.png?v=1600`, pfp: `${ART}/pfp-summit.png`, wave: `${ART}/wave-summit.mp4?v=2` },
  spirit: { label: 'Spirit', glyph: '✦', character: `${ART}/char-aurora.png?v=1600`, pfp: `${ART}/pfp-aurora.png`, wave: `${ART}/wave-aurora.mp4?v=2` },
};
/* Landing circles use the same bust crop as the profile portraits.
   zoom is the source square as a fraction of frame width; top is a fraction of frame height. */
const WAVE_FACE = {
  water: { zoom: 0.72, top: 0.04 },
  earth: { zoom: 0.78, top: 0 },
  fire: { zoom: 0.7, top: 0.05 },
  air: { zoom: 0.76, top: 0.01 },
  spirit: { zoom: 0.7, top: 0.07 },
};
const REALM_ORDER = ['water', 'earth', 'fire', 'air', 'spirit'];
const ELEMENT_LINES = [
  'Your quest has begun. Five elements await.',
  'One element awakened. Four remain.',
  'Two elements awakened. Keep exploring.',
  'More than halfway. Two elements remain.',
  'One Guardian remains. Awaken the final element.',
  'All five elements are awake. Visit the Winter Keeper Throne to confirm your quest is complete.',
];
const RUNE_SHAPES = {
  vortex: { tray: "<svg viewBox=\"39.28 37.95 25.32 25.32\" aria-hidden=\"true\"><path d=\"M47.18 48.97 L46.53 48.57 L46.05 48.18 L45.63 47.77 L45.26 47.33 L44.94 46.87 L44.67 46.38 L44.43 45.88 L44.24 45.36 L44.09 44.82 L43.98 44.27 L43.90 43.70 L43.87 43.13 L43.88 42.54 L43.94 41.95\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M52.30 48.07 L52.97 47.71 L53.55 47.49 L54.12 47.33 L54.68 47.23 L55.24 47.19 L55.80 47.19 L56.35 47.24 L56.90 47.33 L57.44 47.47 L57.98 47.65 L58.50 47.87 L59.01 48.13 L59.51 48.43 L60.00 48.77\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M50.52 52.95 L50.50 53.72 L50.40 54.33 L50.25 54.90 L50.05 55.44 L49.81 55.95 L49.53 56.43 L49.22 56.88 L48.86 57.31 L48.47 57.71 L48.05 58.08 L47.59 58.43 L47.11 58.74 L46.60 59.02 L46.06 59.27\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", full: "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><path d=\"M47.18 48.97 L46.53 48.57 L46.05 48.18 L45.63 47.77 L45.26 47.33 L44.94 46.87 L44.67 46.38 L44.43 45.88 L44.24 45.36 L44.09 44.82 L43.98 44.27 L43.90 43.70 L43.87 43.13 L43.88 42.54 L43.94 41.95\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M52.30 48.07 L52.97 47.71 L53.55 47.49 L54.12 47.33 L54.68 47.23 L55.24 47.19 L55.80 47.19 L56.35 47.24 L56.90 47.33 L57.44 47.47 L57.98 47.65 L58.50 47.87 L59.01 48.13 L59.51 48.43 L60.00 48.77\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M50.52 52.95 L50.50 53.72 L50.40 54.33 L50.25 54.90 L50.05 55.44 L49.81 55.95 L49.53 56.43 L49.22 56.88 L48.86 57.31 L48.47 57.71 L48.05 58.08 L47.59 58.43 L47.11 58.74 L46.60 59.02 L46.06 59.27\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>" },
  draft: { tray: "<svg viewBox=\"24.37 27.52 44.48 44.48\" aria-hidden=\"true\"><path d=\"M43.94 41.95 L44.03 41.36 L44.16 40.76 L44.34 40.17 L44.56 39.58 L44.81 38.99 L45.11 38.41 L45.45 37.84 L45.83 37.28 L46.25 36.73 L46.71 36.20 L47.20 35.69 L47.73 35.20 L48.30 34.73 L48.90 34.29 L49.54 33.87 L50.21 33.48 L50.91 33.12 L51.64 32.79 L52.39 32.50 L53.18 32.24 L53.99 32.02 L54.82 31.84 L55.67 31.70 L56.54 31.60 L57.43 31.54 L58.34 31.52 L59.25 31.56 L60.18 31.63\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60.00 48.77 L60.47 49.15 L60.92 49.56 L61.34 50.01 L61.75 50.50 L62.13 51.02 L62.48 51.56 L62.81 52.14 L63.10 52.75 L63.37 53.39 L63.60 54.05 L63.79 54.73 L63.95 55.44 L64.07 56.16 L64.16 56.91 L64.20 57.67 L64.20 58.44 L64.17 59.22 L64.08 60.02 L63.96 60.82 L63.79 61.63 L63.58 62.44 L63.32 63.25 L63.02 64.06 L62.67 64.87 L62.27 65.67 L61.83 66.46 L61.35 67.24 L60.82 68.00\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M46.06 59.27 L45.50 59.49 L44.92 59.67 L44.32 59.82 L43.69 59.93 L43.06 60.00 L42.40 60.03 L41.74 60.02 L41.07 59.97 L40.38 59.88 L39.70 59.75 L39.01 59.58 L38.32 59.37 L37.63 59.11 L36.94 58.81 L36.26 58.47 L35.59 58.08 L34.93 57.66 L34.28 57.19 L33.65 56.68 L33.03 56.13 L32.44 55.54 L31.86 54.91 L31.31 54.24 L30.79 53.54 L30.30 52.79 L29.83 52.02 L29.40 51.21 L29.00 50.37\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", full: "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><path d=\"M43.94 41.95 L44.03 41.36 L44.16 40.76 L44.34 40.17 L44.56 39.58 L44.81 38.99 L45.11 38.41 L45.45 37.84 L45.83 37.28 L46.25 36.73 L46.71 36.20 L47.20 35.69 L47.73 35.20 L48.30 34.73 L48.90 34.29 L49.54 33.87 L50.21 33.48 L50.91 33.12 L51.64 32.79 L52.39 32.50 L53.18 32.24 L53.99 32.02 L54.82 31.84 L55.67 31.70 L56.54 31.60 L57.43 31.54 L58.34 31.52 L59.25 31.56 L60.18 31.63\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60.00 48.77 L60.47 49.15 L60.92 49.56 L61.34 50.01 L61.75 50.50 L62.13 51.02 L62.48 51.56 L62.81 52.14 L63.10 52.75 L63.37 53.39 L63.60 54.05 L63.79 54.73 L63.95 55.44 L64.07 56.16 L64.16 56.91 L64.20 57.67 L64.20 58.44 L64.17 59.22 L64.08 60.02 L63.96 60.82 L63.79 61.63 L63.58 62.44 L63.32 63.25 L63.02 64.06 L62.67 64.87 L62.27 65.67 L61.83 66.46 L61.35 67.24 L60.82 68.00\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M46.06 59.27 L45.50 59.49 L44.92 59.67 L44.32 59.82 L43.69 59.93 L43.06 60.00 L42.40 60.03 L41.74 60.02 L41.07 59.97 L40.38 59.88 L39.70 59.75 L39.01 59.58 L38.32 59.37 L37.63 59.11 L36.94 58.81 L36.26 58.47 L35.59 58.08 L34.93 57.66 L34.28 57.19 L33.65 56.68 L33.03 56.13 L32.44 55.54 L31.86 54.91 L31.31 54.24 L30.79 53.54 L30.30 52.79 L29.83 52.02 L29.40 51.21 L29.00 50.37\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>" },
  gale: { tray: "<svg viewBox=\"24.08 26.64 55.56 55.56\" aria-hidden=\"true\"><path d=\"M60.18 31.63 L62.03 32.25 L63.83 33.07 L65.58 34.07 L67.25 35.26 L68.81 36.63 L70.26 38.17 L71.57 39.87 L72.73 41.71 L73.71 43.68 L74.51 45.77 L75.10 47.95 L75.48 50.20 L75.64 52.50 L75.57 54.83 L75.27 57.16 L74.74 59.46 L73.98 61.72 L72.99 63.91 L71.78 66.00 L70.37 67.97 L68.76 69.79 L66.97 71.45 L65.02 72.93 L62.93 74.21 L60.72 75.28 L58.42 76.11 L56.04 76.72 L53.62 77.08 L51.19 77.20 L48.76 77.08 L46.37 76.71 L44.04 76.11 L41.79 75.28 L39.66 74.24 L37.66 72.99 L35.81 71.57 L34.13 69.98 L32.63 68.25 L31.34 66.39 L30.25 64.44 L29.37 62.42 L28.72 60.35 L28.29 58.25 L28.08 56.16 L28.08 54.09 L28.29 52.07 L28.70 50.12 L29.29 48.26 L30.06 46.51 L30.98 44.89 L32.04 43.41 L33.21 42.07 L34.49 40.90 L35.84 39.89 L37.25 39.06 L38.69 38.39 L40.15 37.89 L41.61 37.56\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", full: "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><path d=\"M60.18 31.63 L62.03 32.25 L63.83 33.07 L65.58 34.07 L67.25 35.26 L68.81 36.63 L70.26 38.17 L71.57 39.87 L72.73 41.71 L73.71 43.68 L74.51 45.77 L75.10 47.95 L75.48 50.20 L75.64 52.50 L75.57 54.83 L75.27 57.16 L74.74 59.46 L73.98 61.72 L72.99 63.91 L71.78 66.00 L70.37 67.97 L68.76 69.79 L66.97 71.45 L65.02 72.93 L62.93 74.21 L60.72 75.28 L58.42 76.11 L56.04 76.72 L53.62 77.08 L51.19 77.20 L48.76 77.08 L46.37 76.71 L44.04 76.11 L41.79 75.28 L39.66 74.24 L37.66 72.99 L35.81 71.57 L34.13 69.98 L32.63 68.25 L31.34 66.39 L30.25 64.44 L29.37 62.42 L28.72 60.35 L28.29 58.25 L28.08 56.16 L28.08 54.09 L28.29 52.07 L28.70 50.12 L29.29 48.26 L30.06 46.51 L30.98 44.89 L32.04 43.41 L33.21 42.07 L34.49 40.90 L35.84 39.89 L37.25 39.06 L38.69 38.39 L40.15 37.89 L41.61 37.56\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>" },
  zephyr: { tray: "<svg viewBox=\"16.12 21.64 56.19 56.19\" aria-hidden=\"true\"><path d=\"M60.82 68.00 L59.36 69.29 L57.75 70.45 L56.01 71.46 L54.14 72.30 L52.17 72.98 L50.11 73.46 L47.99 73.75 L45.81 73.83 L43.61 73.69 L41.41 73.34 L39.23 72.76 L37.09 71.97 L35.01 70.96 L33.03 69.73 L31.17 68.31 L29.43 66.70 L27.86 64.91 L26.46 62.96 L25.26 60.87 L24.26 58.66 L23.48 56.35 L22.94 53.97 L22.63 51.54 L22.57 49.09 L22.75 46.65 L23.18 44.23 L23.84 41.87 L24.73 39.60 L25.85 37.43 L27.17 35.39 L28.69 33.50 L30.37 31.78 L32.21 30.25 L34.18 28.93 L36.26 27.81 L38.42 26.93 L40.63 26.26 L42.88 25.84 L45.14 25.64 L47.37 25.67 L49.56 25.93 L51.68 26.40 L53.71 27.07 L55.63 27.94 L57.42 28.97 L59.06 30.16 L60.54 31.49 L61.86 32.94 L62.99 34.47 L63.93 36.08 L64.69 37.74 L65.26 39.43 L65.64 41.12 L65.83 42.79 L65.85 44.43 L65.71 46.01 L65.41 47.53 L64.96 48.95\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", full: "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><path d=\"M60.82 68.00 L59.36 69.29 L57.75 70.45 L56.01 71.46 L54.14 72.30 L52.17 72.98 L50.11 73.46 L47.99 73.75 L45.81 73.83 L43.61 73.69 L41.41 73.34 L39.23 72.76 L37.09 71.97 L35.01 70.96 L33.03 69.73 L31.17 68.31 L29.43 66.70 L27.86 64.91 L26.46 62.96 L25.26 60.87 L24.26 58.66 L23.48 56.35 L22.94 53.97 L22.63 51.54 L22.57 49.09 L22.75 46.65 L23.18 44.23 L23.84 41.87 L24.73 39.60 L25.85 37.43 L27.17 35.39 L28.69 33.50 L30.37 31.78 L32.21 30.25 L34.18 28.93 L36.26 27.81 L38.42 26.93 L40.63 26.26 L42.88 25.84 L45.14 25.64 L47.37 25.67 L49.56 25.93 L51.68 26.40 L53.71 27.07 L55.63 27.94 L57.42 28.97 L59.06 30.16 L60.54 31.49 L61.86 32.94 L62.99 34.47 L63.93 36.08 L64.69 37.74 L65.26 39.43 L65.64 41.12 L65.83 42.79 L65.85 44.43 L65.71 46.01 L65.41 47.53 L64.96 48.95\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>" },
  squall: { tray: "<svg viewBox=\"24.42 18.21 55.74 55.74\" aria-hidden=\"true\"><path d=\"M29.00 50.37 L28.62 48.46 L28.42 46.49 L28.42 44.47 L28.61 42.43 L29.02 40.39 L29.62 38.37 L30.44 36.38 L31.46 34.46 L32.67 32.62 L34.08 30.89 L35.67 29.29 L37.43 27.83 L39.34 26.54 L41.39 25.44 L43.56 24.53 L45.82 23.84 L48.16 23.37 L50.55 23.14 L52.96 23.14 L55.37 23.38 L57.76 23.86 L60.09 24.58 L62.35 25.53 L64.50 26.70 L66.53 28.08 L68.41 29.65 L70.12 31.41 L71.64 33.32 L72.96 35.37 L74.07 37.54 L74.95 39.79 L75.59 42.11 L75.99 44.47 L76.16 46.84 L76.08 49.19 L75.77 51.51 L75.24 53.76 L74.49 55.92 L73.53 57.97 L72.38 59.89 L71.07 61.65 L69.60 63.25 L68.00 64.68 L66.29 65.91 L64.50 66.94 L62.65 67.76 L60.76 68.39 L58.85 68.80 L56.95 69.01 L55.09 69.03 L53.27 68.85 L51.53 68.50 L49.88 67.98 L48.33 67.32 L46.90 66.52 L45.60 65.60 L44.44 64.58 L43.42 63.48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>", full: "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><path d=\"M29.00 50.37 L28.62 48.46 L28.42 46.49 L28.42 44.47 L28.61 42.43 L29.02 40.39 L29.62 38.37 L30.44 36.38 L31.46 34.46 L32.67 32.62 L34.08 30.89 L35.67 29.29 L37.43 27.83 L39.34 26.54 L41.39 25.44 L43.56 24.53 L45.82 23.84 L48.16 23.37 L50.55 23.14 L52.96 23.14 L55.37 23.38 L57.76 23.86 L60.09 24.58 L62.35 25.53 L64.50 26.70 L66.53 28.08 L68.41 29.65 L70.12 31.41 L71.64 33.32 L72.96 35.37 L74.07 37.54 L74.95 39.79 L75.59 42.11 L75.99 44.47 L76.16 46.84 L76.08 49.19 L75.77 51.51 L75.24 53.76 L74.49 55.92 L73.53 57.97 L72.38 59.89 L71.07 61.65 L69.60 63.25 L68.00 64.68 L66.29 65.91 L64.50 66.94 L62.65 67.76 L60.76 68.39 L58.85 68.80 L56.95 69.01 L55.09 69.03 L53.27 68.85 L51.53 68.50 L49.88 67.98 L48.33 67.32 L46.90 66.52 L45.60 65.60 L44.44 64.58 L43.42 63.48\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>" }
};
const RUNE_FULL = "<svg viewBox=\"0 0 100 100\" aria-hidden=\"true\"><path d=\"M47.18 48.97 L46.53 48.57 L46.05 48.18 L45.63 47.77 L45.26 47.33 L44.94 46.87 L44.67 46.38 L44.43 45.88 L44.24 45.36 L44.09 44.82 L43.98 44.27 L43.90 43.70 L43.87 43.13 L43.88 42.54 L43.94 41.95\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M52.30 48.07 L52.97 47.71 L53.55 47.49 L54.12 47.33 L54.68 47.23 L55.24 47.19 L55.80 47.19 L56.35 47.24 L56.90 47.33 L57.44 47.47 L57.98 47.65 L58.50 47.87 L59.01 48.13 L59.51 48.43 L60.00 48.77\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M50.52 52.95 L50.50 53.72 L50.40 54.33 L50.25 54.90 L50.05 55.44 L49.81 55.95 L49.53 56.43 L49.22 56.88 L48.86 57.31 L48.47 57.71 L48.05 58.08 L47.59 58.43 L47.11 58.74 L46.60 59.02 L46.06 59.27\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M43.94 41.95 L44.03 41.36 L44.16 40.76 L44.34 40.17 L44.56 39.58 L44.81 38.99 L45.11 38.41 L45.45 37.84 L45.83 37.28 L46.25 36.73 L46.71 36.20 L47.20 35.69 L47.73 35.20 L48.30 34.73 L48.90 34.29 L49.54 33.87 L50.21 33.48 L50.91 33.12 L51.64 32.79 L52.39 32.50 L53.18 32.24 L53.99 32.02 L54.82 31.84 L55.67 31.70 L56.54 31.60 L57.43 31.54 L58.34 31.52 L59.25 31.56 L60.18 31.63\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60.00 48.77 L60.47 49.15 L60.92 49.56 L61.34 50.01 L61.75 50.50 L62.13 51.02 L62.48 51.56 L62.81 52.14 L63.10 52.75 L63.37 53.39 L63.60 54.05 L63.79 54.73 L63.95 55.44 L64.07 56.16 L64.16 56.91 L64.20 57.67 L64.20 58.44 L64.17 59.22 L64.08 60.02 L63.96 60.82 L63.79 61.63 L63.58 62.44 L63.32 63.25 L63.02 64.06 L62.67 64.87 L62.27 65.67 L61.83 66.46 L61.35 67.24 L60.82 68.00\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M46.06 59.27 L45.50 59.49 L44.92 59.67 L44.32 59.82 L43.69 59.93 L43.06 60.00 L42.40 60.03 L41.74 60.02 L41.07 59.97 L40.38 59.88 L39.70 59.75 L39.01 59.58 L38.32 59.37 L37.63 59.11 L36.94 58.81 L36.26 58.47 L35.59 58.08 L34.93 57.66 L34.28 57.19 L33.65 56.68 L33.03 56.13 L32.44 55.54 L31.86 54.91 L31.31 54.24 L30.79 53.54 L30.30 52.79 L29.83 52.02 L29.40 51.21 L29.00 50.37\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60.18 31.63 L62.03 32.25 L63.83 33.07 L65.58 34.07 L67.25 35.26 L68.81 36.63 L70.26 38.17 L71.57 39.87 L72.73 41.71 L73.71 43.68 L74.51 45.77 L75.10 47.95 L75.48 50.20 L75.64 52.50 L75.57 54.83 L75.27 57.16 L74.74 59.46 L73.98 61.72 L72.99 63.91 L71.78 66.00 L70.37 67.97 L68.76 69.79 L66.97 71.45 L65.02 72.93 L62.93 74.21 L60.72 75.28 L58.42 76.11 L56.04 76.72 L53.62 77.08 L51.19 77.20 L48.76 77.08 L46.37 76.71 L44.04 76.11 L41.79 75.28 L39.66 74.24 L37.66 72.99 L35.81 71.57 L34.13 69.98 L32.63 68.25 L31.34 66.39 L30.25 64.44 L29.37 62.42 L28.72 60.35 L28.29 58.25 L28.08 56.16 L28.08 54.09 L28.29 52.07 L28.70 50.12 L29.29 48.26 L30.06 46.51 L30.98 44.89 L32.04 43.41 L33.21 42.07 L34.49 40.90 L35.84 39.89 L37.25 39.06 L38.69 38.39 L40.15 37.89 L41.61 37.56\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M60.82 68.00 L59.36 69.29 L57.75 70.45 L56.01 71.46 L54.14 72.30 L52.17 72.98 L50.11 73.46 L47.99 73.75 L45.81 73.83 L43.61 73.69 L41.41 73.34 L39.23 72.76 L37.09 71.97 L35.01 70.96 L33.03 69.73 L31.17 68.31 L29.43 66.70 L27.86 64.91 L26.46 62.96 L25.26 60.87 L24.26 58.66 L23.48 56.35 L22.94 53.97 L22.63 51.54 L22.57 49.09 L22.75 46.65 L23.18 44.23 L23.84 41.87 L24.73 39.60 L25.85 37.43 L27.17 35.39 L28.69 33.50 L30.37 31.78 L32.21 30.25 L34.18 28.93 L36.26 27.81 L38.42 26.93 L40.63 26.26 L42.88 25.84 L45.14 25.64 L47.37 25.67 L49.56 25.93 L51.68 26.40 L53.71 27.07 L55.63 27.94 L57.42 28.97 L59.06 30.16 L60.54 31.49 L61.86 32.94 L62.99 34.47 L63.93 36.08 L64.69 37.74 L65.26 39.43 L65.64 41.12 L65.83 42.79 L65.85 44.43 L65.71 46.01 L65.41 47.53 L64.96 48.95\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M29.00 50.37 L28.62 48.46 L28.42 46.49 L28.42 44.47 L28.61 42.43 L29.02 40.39 L29.62 38.37 L30.44 36.38 L31.46 34.46 L32.67 32.62 L34.08 30.89 L35.67 29.29 L37.43 27.83 L39.34 26.54 L41.39 25.44 L43.56 24.53 L45.82 23.84 L48.16 23.37 L50.55 23.14 L52.96 23.14 L55.37 23.38 L57.76 23.86 L60.09 24.58 L62.35 25.53 L64.50 26.70 L66.53 28.08 L68.41 29.65 L70.12 31.41 L71.64 33.32 L72.96 35.37 L74.07 37.54 L74.95 39.79 L75.59 42.11 L75.99 44.47 L76.16 46.84 L76.08 49.19 L75.77 51.51 L75.24 53.76 L74.49 55.92 L73.53 57.97 L72.38 59.89 L71.07 61.65 L69.60 63.25 L68.00 64.68 L66.29 65.91 L64.50 66.94 L62.65 67.76 L60.76 68.39 L58.85 68.80 L56.95 69.01 L55.09 69.03 L53.27 68.85 L51.53 68.50 L49.88 67.98 L48.33 67.32 L46.90 66.52 L45.60 65.60 L44.44 64.58 L43.42 63.48\" fill=\"none\" stroke=\"currentColor\" opacity=\"0.22\" stroke-width=\"6.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
function runeShapeSvg(id, which = "tray") {
  const shape = RUNE_SHAPES[id];
  if (!shape) return "";
  return shape[which] || shape.tray || "";
}

const TILE_ART = {
  'ice-vein': `${ART}/cascade-ice-vein.svg`,
  'lantern-glow': `${ART}/cascade-lantern-glow.svg`,
  'ice-arch': `${ART}/cascade-ice-arch.svg`,
  'silk-wing': `${ART}/cascade-silk-wing.svg`,
  'ice-ripple': `${ART}/cascade-ice-ripple.svg`,
  'rune-cut': `${ART}/cascade-rune-cut.svg`,
};
const LANTERN_ART = {
  ice: `${ART}/lantern-ice.png`,
  amber: `${ART}/lantern-amber.png`,
  rose: `${ART}/lantern-rose.png`,
  violet: `${ART}/lantern-violet.png`,
};

function realmIcon(realm, on = true) {
  return `${ART}/realm-${realm}-${on ? 'on' : 'off'}.png`;
}
function realmPfp(realm) {
  return REALM_META[realm]?.pfp || realmIcon(realm, true);
}
function realmCharacter(realm) {
  return REALM_META[realm]?.character || realmPfp(realm);
}
function realmPad(realm) {
  return `${ART}/pad-${realm}.png`;
}
const STATION_ICON = {
  threshold: `${ART}/icon-threshold.svg?v=1`,
  monument: `${ART}/icon-builders.svg?v=1`,
  heart: `${ART}/icon-throne.svg?v=1`,
};

function stationArt(station) {
  if (station.element && REALM_META[station.element]) return realmCharacter(station.element);
  if (station.imageUrl) return station.imageUrl;
  return STATION_ICON[station.type] || '';
}

/* Swirl that holds a character's frame until the painting has decoded.
   The veil canvas is 128% of the frame so the poof can leave the picture. */
const SUMMON_PAD = 1.28;
const SUMMON_REALMS = {
  water: {
    spin: 1.25, shape: 'bubble',
    glow: 'rgba(255, 255, 255, 0.72)', arc: 'rgba(255, 255, 255, 0.95)', flash: '#ffffff',
    colors: ['#0e6eae', '#1478c4', '#1c86c9', '#0b5f98', '#3aa0d8'],
  },
  earth: {
    spin: 0.58, shape: 'leaf',
    glow: 'rgba(198, 214, 120, 0.42)', arc: 'rgba(226, 206, 130, 0.85)', flash: '#f6efc4',
    colors: ['#8fd06a', '#d2c06a', '#c4a15a', '#e7f0c4', '#6ea84a', '#f0e2b0'],
  },
  fire: {
    spin: 1.55, shape: 'ember',
    glow: 'rgba(255, 150, 40, 0.5)', arc: 'rgba(255, 206, 110, 0.9)', flash: '#fff1c4',
    colors: ['#fff6d2', '#ffd27a', '#ff9a3c', '#ff5a1a', '#ffe7a8'],
  },
  air: {
    spin: 1.95, shape: 'streak',
    glow: 'rgba(255, 255, 255, 0.38)', arc: 'rgba(255, 255, 255, 0.9)', flash: '#ffffff',
    colors: ['#ffffff', '#f4fbff', '#d5e6f0', '#ffffff', '#e7f2f8'],
  },
  spirit: {
    spin: 0.74, shape: 'star',
    glow: 'rgba(220, 180, 255, 0.5)', arc: 'rgba(240, 220, 255, 0.92)', flash: '#f7ecff',
    colors: ['#ffffff', '#f3e4ff', '#d7b4ff', '#e7d0ff', '#fff6ff'],
  },
  ice: {
    spin: 1.02, shape: 'crystal',
    glow: 'rgba(130, 196, 232, 0.4)', arc: 'rgba(70, 150, 204, 0.75)', flash: '#ffffff',
    colors: ['#ffffff', '#7ec4e6', '#2f86b8', '#d4eefb', '#e8f6ff'],
  },
};
const SUMMON_RATIO = {
  water: [1600, 1600],
  earth: [1600, 1600],
  fire: [1600, 1600],
  air: [1600, 1600],
  spirit: [1600, 1600],
  ice: [819, 1024],
};
/* Opaque subject height in each 1600 square — scale so shrine heroes match. */
const HERO_CONTENT_H = {
  water: 1287,
  earth: 1445,
  fire: 1287,
  air: 1287,
  spirit: 1231,
};
const HERO_FIT_TARGET = Math.max(...Object.values(HERO_CONTENT_H));
const HERO_FIT = Object.fromEntries(
  Object.entries(HERO_CONTENT_H).map(([realm, h]) => [realm, HERO_FIT_TARGET / h]),
);
const SUMMON_SWIRL_MS = 1500;
const SUMMON_FRAME_MS = 100;
const summonJobs = new Set();
let summonRaf = 0;

function summonHtml(src, className, realm, { hero = false } = {}) {
  const key = SUMMON_REALMS[realm] ? realm : 'ice';
  const [w, h] = SUMMON_RATIO[key];
  const portrait = className === 'shrine__portrait';
  const cls = `summon${portrait ? ' summon--portrait' : ''}${hero ? ' shrine__hero' : ''}`;
  const priority = hero ? ' fetchpriority="high"' : '';
  const fit = hero && HERO_FIT[key] ? `;--hero-fit:${HERO_FIT[key].toFixed(4)}` : '';
  return `<div class="${cls}" data-realm="${escapeHtml(key)}" style="--summon-w:${w};--summon-h:${h}${fit}" aria-busy="true">
    <canvas class="summon__veil" width="2" height="2" aria-hidden="true"></canvas>
    <img class="${className}" src="${escapeHtml(src)}" alt=""${priority}>
  </div>`;
}

function summonVisible(frame) {
  if (!frame.isConnected || document.hidden) return false;
  if (document.body.classList.contains('landing-open')) return false;
  if (document.body.classList.contains('guide-open')) return false;
  const panel = frame.closest('.shrinePanel');
  if (panel && !panel.classList.contains('is-open')) return false;
  const rect = frame.getBoundingClientRect();
  return rect.width > 2 && rect.bottom > 0 && rect.top < window.innerHeight + 48;
}

function makeSummonParts(count, spec) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const r = 0.14 + Math.random() ** 0.7 * 0.86;
    parts.push({
      a: Math.random() * Math.PI * 2,
      r,
      w: (Math.random() < 0.14 ? -1 : 1) * (0.55 + (1 - r) * 1.75) * (0.72 + Math.random() * 0.7),
      size: (spec.shape === 'bubble' ? 5.5 : spec.shape === 'streak' ? 2.2 : 3.2)
        + Math.random() * (spec.shape === 'bubble' ? 8 : spec.shape === 'star' ? 5.5 : 4.6),
      color: spec.colors[(Math.random() * spec.colors.length) | 0],
      seed: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 1.7,
      spin: (Math.random() - 0.5) * 3.2,
      pebble: spec.shape === 'leaf' && Math.random() < 0.28,
    });
  }
  return parts;
}

function placeSummon(p, t, spec, R) {
  const a = p.a + t * p.w * spec.spin;
  let x = Math.cos(a) * p.r * R;
  let y = Math.sin(a) * p.r * R;
  let alpha = 0.62;
  let scale = 1;
  let rot = a;
  if (spec.shape === 'bubble') {
    y -= Math.sin(t * 1.5 + p.seed) * 8;
    scale = 0.9 + 0.22 * Math.sin(t * p.tw * 2 + p.seed);
    alpha = 0.88;
  } else if (spec.shape === 'leaf') {
    rot = t * p.spin + p.seed;
    y += Math.sin(t * 0.7 + p.seed) * 6;
    alpha = 0.82;
  } else if (spec.shape === 'ember') {
    const flicker = 0.4 + 0.6 * Math.abs(Math.sin(t * 8 * p.tw + p.seed));
    y -= R * 0.18 * (1.2 - p.r);
    alpha = flicker;
    scale = 0.72 + flicker * 0.5;
  } else if (spec.shape === 'streak') {
    x *= 1.08;
    y *= 0.68;
    rot = a + Math.PI / 2;
    alpha = 0.32 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3 + p.seed));
  } else if (spec.shape === 'star') {
    const tw = Math.abs(Math.sin(t * p.tw * 2.4 + p.seed));
    alpha = 0.22 + 0.78 * tw;
    scale = 0.62 + tw * 0.75;
    rot = t * 0.45 + p.seed;
  } else {
    rot = t * p.spin + p.seed;
    alpha = 0.4 + 0.55 * Math.abs(Math.sin(t * p.tw + p.seed));
  }
  return { x, y, alpha: Math.max(0, alpha), scale, rot };
}

function traceStar(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const a = rot + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.38;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function drawSummonMote(ctx, spec, p, x, y, alpha, scale) {
  if (alpha < 0.03) return;
  const size = Math.max(0.6, p.size * scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  if (p.spark || spec.shape === 'crystal') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.52, 0);
    ctx.lineTo(0, size * 1.2);
    ctx.lineTo(-size * 0.52, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  if (spec.shape === 'bubble') {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, size * 0.16);
    ctx.strokeStyle = p.color;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(x - size * 0.3, y - size * 0.32, Math.max(0.8, size * 0.26), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (spec.shape === 'leaf') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot || 0);
    ctx.beginPath();
    if (p.pebble) ctx.ellipse(0, 0, size * 0.72, size * 0.52, 0, 0, Math.PI * 2);
    else ctx.ellipse(0, 0, size * 0.4, size * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!p.pebble) {
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = 'rgba(255, 248, 220, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (spec.shape === 'ember') {
    ctx.globalAlpha = alpha * 0.32;
    ctx.beginPath();
    ctx.arc(x, y, size * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = '#fff6d4';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, size * 0.26), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (spec.shape === 'streak') {
    const rot = p.rot || 0;
    const len = size * 4.4;
    const x2 = x + Math.cos(rot) * len;
    const y2 = y + Math.sin(rot) * len;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(24, 58, 84, 0.55)';
    ctx.lineWidth = Math.max(2.2, size * 0.85);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(rot) * len * 0.15, y - Math.sin(rot) * len * 0.15);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.2, size * 0.42);
    ctx.stroke();
    return;
  }
  traceStar(ctx, x, y, size * 1.15, p.rot || 0);
  ctx.fill();
}

function drawSummonField(job, t, fade) {
  const { ctx, cx, cy, R, spec } = job;
  ctx.clearRect(0, 0, job.cssW, job.cssH);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * spec.spin * 0.42);
  ctx.strokeStyle = spec.arc;
  ctx.globalAlpha = 0.62 * fade;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    ctx.rotate(2.12);
    ctx.beginPath();
    ctx.arc(0, 0, R * (0.3 + i * 0.22), 0.2, 2.2);
    ctx.stroke();
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(cx, cy, R * 0.02, cx, cy, R * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.92)');
  glow.addColorStop(0.28, spec.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = (0.9 + Math.sin(t * 2.2) * 0.1) * fade;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.66, 0, Math.PI * 2);
  ctx.fill();
  for (const p of job.parts) {
    drawSummonMote(ctx, spec, p, p.x, p.y, p.alpha * fade, p.scale);
  }
  ctx.globalAlpha = 1;
}

function layoutSummon(job) {
  const canvas = job.canvas;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW < 2 || cssH < 2) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(cssW * dpr);
  const h = Math.round(cssH * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  job.ctx = ctx;
  job.cssW = cssW;
  job.cssH = cssH;
  job.cx = cssW / 2;
  job.cy = cssH / 2;
  job.R = (Math.min(cssW, cssH) / SUMMON_PAD) * 0.46;
  return job.R > 4;
}

function positionSwirl(job, t) {
  for (const p of job.parts) {
    const at = placeSummon(p, t, job.spec, job.R);
    p.x = job.cx + at.x;
    p.y = job.cy + at.y;
    p.alpha = at.alpha;
    p.scale = at.scale;
    p.rot = at.rot;
  }
}

function beginSummonPoof(job, now) {
  job.phase = 'poof';
  job.poofAt = now;
  job.frame.dataset.summonAt = String(now);
  job.frame.classList.add('is-shown');
  job.frame.setAttribute('aria-busy', 'false');
  settleSummon(job.frame, false);
  const { cx, cy, spec } = job;
  for (const p of job.parts) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const mag = Math.hypot(dx, dy) || 1;
    const kick = 78 + Math.random() * 90;
    p.vx = (dx / mag) * kick + (Math.random() - 0.5) * 28;
    p.vy = (dy / mag) * kick + (Math.random() - 0.5) * 28;
    p.px = p.x;
    p.py = p.y;
  }
  for (let i = 0; i < 16; i += 1) {
    const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.35;
    const kick = 40 + Math.random() * 100;
    job.parts.push({
      spark: true,
      px: cx,
      py: cy,
      vx: Math.cos(ang) * kick,
      vy: Math.sin(ang) * kick,
      size: 1.6 + Math.random() * 2.4,
      color: spec.colors[i % spec.colors.length],
      rot: ang,
      alpha: 1,
      scale: 1,
    });
  }
}

function drawSummonPoof(job, now) {
  const sec = (now - job.poofAt) / 1000;
  const life = Math.max(0, 1 - sec / 0.44);
  const { ctx, cx, cy, spec } = job;
  ctx.clearRect(0, 0, job.cssW, job.cssH);
  const flash = Math.max(0, 1 - sec / 0.24);
  ctx.globalAlpha = flash * 0.9;
  ctx.strokeStyle = spec.flash;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 6 + sec * 168, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = flash * 0.35;
  ctx.fillStyle = spec.flash;
  ctx.beginPath();
  ctx.arc(cx, cy, 10 + sec * 70, 0, Math.PI * 2);
  ctx.fill();
  for (const p of job.parts) {
    const x = p.px + p.vx * sec;
    const y = p.py + p.vy * sec;
    const pop = (p.spark ? 1 : Math.max(0.7, p.alpha || 1)) * life;
    drawSummonMote(ctx, spec, p, x, y, pop, (p.scale || 1) * (1 + sec * 0.45));
  }
  ctx.globalAlpha = 1;
  if (sec >= 0.44) {
    job.canvas.remove();
    job.done = true;
  }
}

function settleSummon(frame, instant) {
  if (instant) {
    frame.classList.add('is-settled');
    return;
  }
  const img = frame.querySelector('img');
  if (!img) {
    frame.classList.add('is-settled');
    return;
  }
  const onEnd = (event) => {
    if (event.animationName !== 'summonZoom') return;
    img.removeEventListener('animationend', onEnd);
    frame.classList.add('is-settled');
  };
  img.addEventListener('animationend', onEnd);
  window.setTimeout(() => {
    if (frame.isConnected) frame.classList.add('is-settled');
  }, 800);
}

function syncSkyWind() {
  const sky = document.querySelector('.realmSky .wind');
  if (!sky) return;
  const holding = [...summonJobs].some((job) => job.wind);
  sky.style.visibility = holding ? 'hidden' : '';
}

function stopSummonWind(job) {
  if (!job.wind) return;
  job.wind.stop();
  job.wind = null;
  syncSkyWind();
}

function showSummon(job, instant) {
  stopSummonWind(job);
  job.frame.dataset.summonAt = String(performance.now());
  job.frame.classList.add('is-shown');
  if (instant) job.frame.classList.add('is-instant');
  settleSummon(job.frame, instant);
  job.frame.setAttribute('aria-busy', 'false');
  if (job.canvas.isConnected) job.canvas.remove();
  job.done = true;
  job.phase = 'done';
}

function startSwirl(job, now) {
  job.phase = 'swirl';
  job.t0 = now;
  job.elapsed = 0;
  job.played = true;
  if (job.frame.dataset.realm === 'air' && typeof createWindWisps === 'function') {
    job.parts = [];
    job.wind = createWindWisps(job.canvas, {
      orbit: 1,
      speed: 1.2,
      density: 1.35,
      color: '#f4fbff',
      ink: '#ffffff',
      opacity: 1,
      trail: 1,
      spiral: 0.8,
      paused() { return !summonVisible(job.frame); },
    });
    job.wind.start();
    syncSkyWind();
    return;
  }
  const rect = job.frame.getBoundingClientRect();
  const n = Math.round(Math.min(rect.width, rect.height) / 3.3);
  job.parts = makeSummonParts(Math.max(44, Math.min(92, n)), job.spec);
}

function stepSummon(job, now) {
  if (!job.frame.isConnected) {
    stopSummonWind(job);
    job.done = true;
    return;
  }
  if (job.phase === 'wait') {
    if (!job.ready && job.img.complete && job.img.naturalWidth > 0) job.ready = true;
    if (job.failed) {
      showSummon(job, true);
      return;
    }
    if (!summonVisible(job.frame)) return;
    startSwirl(job, now);
  }
  if (job.phase === 'swirl') {
    if (!summonVisible(job.frame) || (!job.wind && !layoutSummon(job))) {
      job.seen = now;
      return;
    }
    if (job.seen) job.elapsed += Math.min(SUMMON_FRAME_MS, Math.max(0, now - job.seen));
    job.seen = now;
    const ripe = (job.ready || job.failed || job.elapsed > 12000) && job.elapsed >= SUMMON_SWIRL_MS;
    if (ripe) {
      stopSummonWind(job);
      if (!layoutSummon(job)) return;
      beginSummonPoof(job, now);
      drawSummonPoof(job, now);
      return;
    }
    if (job.wind) return;
    const t = job.elapsed / 1000;
    positionSwirl(job, t);
    drawSummonField(job, t, 1);
    return;
  }
  if (job.phase === 'poof') {
    if (!job.canvas.isConnected) {
      job.done = true;
      return;
    }
    if (!layoutSummon(job)) return;
    drawSummonPoof(job, now);
  }
}

function tickSummons(now) {
  summonRaf = 0;
  for (const job of summonJobs) stepSummon(job, now);
  for (const job of [...summonJobs]) if (job.done) summonJobs.delete(job);
  if (summonJobs.size) summonRaf = window.requestAnimationFrame(tickSummons);
}

function kickSummons() {
  if (!summonRaf && summonJobs.size) summonRaf = window.requestAnimationFrame(tickSummons);
}

function armSummon(frame) {
  if (frame.dataset.summonOn) return;
  frame.dataset.summonOn = '1';
  frame.classList.add('is-summoning');
  const img = frame.querySelector('img');
  const canvas = frame.querySelector('canvas');
  if (!img || !canvas) return;
  const realm = SUMMON_REALMS[frame.dataset.realm] ? frame.dataset.realm : 'ice';
  const job = {
    frame,
    img,
    canvas,
    spec: SUMMON_REALMS[realm],
    ready: img.complete && img.naturalWidth > 0,
    failed: img.complete && img.naturalWidth === 0,
    phase: 'wait',
    played: false,
    elapsed: 0,
    done: false,
  };
  if (!job.ready && !job.failed) {
    img.addEventListener('load', () => {
      const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
      decoded.then(() => { job.ready = true; }).catch(() => { job.ready = true; });
    }, { once: true });
    img.addEventListener('error', () => { job.failed = true; }, { once: true });
  }
  if (job.failed) {
    showSummon(job, true);
    return;
  }
  summonJobs.add(job);
  kickSummons();
}

function armSummons(root) {
  root.querySelectorAll('.summon').forEach(armSummon);
}

const el = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dom = {
  parkName: el('parkName'), parkLocation: el('parkLocation'),
  progressFill: el('progressFill'), progressLabel: el('progressLabel'),
  progressButton: el('progressButton'),
  questProgress: el('questProgress'), realmPips: el('realmPips'),
  landingProgressLine: el('landingProgressLine'),
  stationView: el('stationView'),
  guideToggle: el('guideToggle'), headerMap: el('headerMap'), guide: el('guide'),
  sheet: el('sheet'), sheetBody: el('sheetBody'), sheetGrip: el('sheetGrip'),
  journeyPanel: el('journeyPanel'), journeyBody: el('journeyBody'),
  passportPanel: el('passportPanel'), passportBody: el('passportBody'),
  toast: el('toast'), splash: el('bootSplash'),
  scanFab: el('scanFab'), recenter: el('recenterButton'),
  filterButton: el('filterButton'), legend: el('legend'), legendRows: el('legendRows'),
  legendHint: el('legendHint'),
  journeyButton: el('journeyButton'),
  threshold: el('threshold'), thresholdStart: el('thresholdStart'),
  landingPlace: el('landingPlace'), landingProgress: el('landingProgress'),
  landingMap: el('landingMap'),
  landingGate: el('landingGate'), landingScene: el('landingScene'),
  landingFx: el('landingFx'), landingFxDebug: el('landingFxDebug'),
  landingParty: el('landingParty'), landingPartySize: el('landingPartySize'),
  landingPartyHint: el('landingPartyHint'),
  beginBrief: el('beginBrief'), beginBriefClose: el('beginBriefClose'),
  beginContinue: el('beginContinue'),
  beginSteps: el('beginSteps'), beginStory: el('beginStory'),
  beginStoryOpen: el('beginStoryOpen'), beginStoryClose: el('beginStoryClose'),
  landingTalk: el('landingTalk'), landingBubble: el('landingBubble'),
  landingBubbleWho: el('landingBubbleWho'), landingBubbleText: el('landingBubbleText'),
  landingRealms: el('landingRealms'),
  mapModal: el('mapModal'), mapModalEyebrow: el('mapModalEyebrow'),
  mapModalTitle: el('mapModalTitle'), mapModalGuardians: el('mapModalGuardians'),
  mapModalBody: el('mapModalBody'),
  mapModalPrimary: el('mapModalPrimary'), mapModalGhost: el('mapModalGhost'),
  finale: el('finale'), finaleCard: el('finaleCard'),
  award: el('award'), awardGlyph: el('awardGlyph'), awardTitle: el('awardTitle'),
  awardMeta: el('awardMeta'), awardKicker: el('awardKicker'), awardPips: el('awardPips'),
  awardDone: el('awardDone'),
};

let currentPanel = null;
let panelTrigger = null;
let awardQueue = [];
let awardShowing = false;
let mapReady = false;
let selectedImages = new Set();
let sequenceBuffer = [];
let shrineFocus = null;
let shrineSlug = null;
let mapModalMode = null;
let mapModalStation = null;

function rememberShrineView(slug, focus) {
  if (!slug) return;
  try {
    sessionStorage.setItem(SHRINE_VIEW_KEY, JSON.stringify({
      slug,
      focus: focus || null,
      at: Date.now(),
    }));
  } catch { /* private mode */ }
}

function rememberedShrineFocus(slug) {
  try {
    const data = JSON.parse(sessionStorage.getItem(SHRINE_VIEW_KEY) || 'null');
    if (!data || data.slug !== slug) return null;
    return data.focus || null;
  } catch {
    return null;
  }
}

function markHistoryView(slug, view, focus = null) {
  const path = Store.stationPath(slug);
  const state = { station: slug, view, focus: focus || null };
  if (`${location.pathname}` !== path) history.pushState(state, '', path);
  else history.replaceState(state, '', `${path}${location.search || ''}`);
  if (view === 'shrine') rememberShrineView(slug, focus);
}

function syncShrineHistoryFocus() {
  if (!shrineSlug) return;
  rememberShrineView(shrineSlug, shrineFocus);
  if (history.state?.view === 'shrine' && history.state?.station === shrineSlug) {
    history.replaceState(
      { station: shrineSlug, view: 'shrine', focus: shrineFocus || null },
      '',
      `${location.pathname}${location.search || ''}`
    );
  }
}

const ICON_BADGE = `
  <circle class="bOut" cx="32" cy="32" r="26"/>
  <circle class="bIn" cx="32" cy="32" r="20.5"/>
  <g class="bGem">
    <path d="M32 4.2 34.3 8.2 32 12.2 29.7 8.2Z"/>
    <path d="M59.8 32 55.8 34.3 51.8 32 55.8 29.7Z"/>
    <path d="M32 59.8 29.7 55.8 32 51.8 34.3 55.8Z"/>
    <path d="M4.2 32 8.2 29.7 12.2 32 8.2 34.3Z"/>
  </g>
  <path class="bTip" d="M32 4.2 34.3 8.2 32 8.2Z"/>`;
const ICON_MEET = `<svg class="realmBtn" viewBox="0 0 64 64" aria-hidden="true">${ICON_BADGE}
  <g class="hand hand--warm" transform="rotate(14 33 33)">
    <rect x="38" y="28" width="15" height="12" rx="4"/>
    <rect x="24" y="23.5" width="18" height="5.2" rx="2.6"/>
    <rect x="22" y="30" width="20" height="5.2" rx="2.6"/>
    <rect x="25" y="36.5" width="16" height="5.2" rx="2.6"/>
  </g>
  <g class="hand hand--pale" transform="rotate(-14 31 33)">
    <rect x="11" y="26" width="15" height="12" rx="4"/>
    <rect x="22" y="21" width="16" height="5.2" rx="2.6"/>
    <rect x="20" y="27.5" width="18" height="5.2" rx="2.6"/>
    <rect x="22" y="34" width="14" height="5.2" rx="2.6"/>
    <ellipse cx="34" cy="20.5" rx="5.4" ry="3.3" transform="rotate(-28 34 20.5)"/>
  </g>
</svg>`;
const ICON_DISCOVER = `<svg class="realmBtn" viewBox="0 0 64 64" aria-hidden="true">${ICON_BADGE}
  <path class="bArc" d="M44 16.5a14 14 0 0 1 6.5 12"/>
  <path class="rose" d="M32 14.5 37.2 27.2 49.5 32 37.2 36.8 32 49.5 26.8 36.8 14.5 32 26.8 27.2Z"/>
  <path class="roseN" d="M32 14.5 37.2 27.2 32 32 26.8 27.2Z"/>
  <circle class="roseHub" cx="32" cy="32" r="2.4"/>
</svg>`;
const ICON_PLAY = `<svg class="realmBtn" viewBox="0 0 64 64" aria-hidden="true">${ICON_BADGE}
  <path class="playA" d="M25 19 45 32 25 45Z"/>
  <path class="playB" d="M25 19 45 32 33 32Z"/>
  <path class="playC" d="M25 19 33 32 25 32Z"/>
  <path class="playD" d="M25 32 33 32 25 45Z"/>
  <path class="playE" d="M33 32 45 32 25 45Z"/>
  <path class="playEdge" d="M25 19 45 32 25 45Z"/>
  <path class="playStar" d="M46 15.5 47.3 18.6 50.4 19.9 47.3 21.2 46 24.3 44.7 21.2 41.6 19.9 44.7 18.6Z"/>
</svg>`;

function setShrineFocus(key, { spin = true, scroll = true, restore = false } = {}) {
  stopStoryAudio();
  const gate = document.querySelector('.shrineGate');
  if (!gate) return;
  // restore=true re-applies a remembered section after reload; do not toggle closed.
  const closing = !restore && shrineFocus === key;
  shrineFocus = closing ? null : key;
  gate.classList.toggle('is-focus', !closing);
  document.querySelector('.shrine')?.classList.toggle('is-play-open', shrineFocus === 'play');
  if (closing) {
    gate.dataset.focus = '';
    gate.classList.remove('is-spinning');
  } else {
    gate.dataset.focus = key;
    if (spin) {
      gate.classList.remove('is-spinning');
      void gate.offsetWidth;
      gate.classList.add('is-spinning');
      window.clearTimeout(setShrineFocus.spinTimer);
      setShrineFocus.spinTimer = window.setTimeout(() => {
        if (gate.isConnected) gate.classList.remove('is-spinning');
      }, 820);
    }
  }
  gate.querySelectorAll('[data-shrine-focus]').forEach((btn) => {
    const on = btn.dataset.shrineFocus === shrineFocus;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  });
  document.querySelectorAll('.shrinePanel').forEach((panel) => {
    panel.classList.toggle('is-open', panel.dataset.panel === shrineFocus);
  });
  syncShrineHistoryFocus();
  if (!closing && shrineFocus === 'play' && scroll) {
    window.requestAnimationFrame(() => {
      const panel = document.querySelector('.shrinePanel.is-open[data-panel="play"]');
      if (!panel) return;
      const target = panel.querySelector('.challenge') || panel;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const heading = panel.querySelector('h3');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    });
  }
}

function toast(message, { warm = false, ms = 3200 } = {}) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle('is-warm', warm);
  dom.toast.classList.add('is-on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => dom.toast.classList.remove('is-on'), ms);
}

function goStation(slug) {
  Store.state.path = Store.pathContext();
  hideMapModal();
  if (slug === 'threshold' || Store.touchBySlug(slug)?.type === 'threshold') {
    markHistoryView(slug, 'threshold');
    Store.state.path = Store.pathContext();
    closePanels();
    closeGuide({ force: true });
    showThreshold();
    return;
  }
  markHistoryView(slug, 'shrine', shrineFocus);
  Store.state.path = Store.pathContext();
  openStation(slug);
}

function goVenueHome() {
  const path = Store.stationPath(null);
  if (`${location.pathname}` !== path) history.replaceState({ station: null }, '', path);
  Store.state.path = Store.pathContext();
}

/* Testing only: /nh?welcome (or /mtl?welcome) opens the hero again after a session exists. */
function wantsWelcomePreview() {
  return new URLSearchParams(location.search).has('welcome');
}

function stripWelcomePreview() {
  const params = new URLSearchParams(location.search);
  if (!params.has('welcome')) return;
  params.delete('welcome');
  const q = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
}

/* -------------------------------------------------------------------------- */
/* progress                                                                   */
/* -------------------------------------------------------------------------- */

function renderProgress() {
  const awakened = Store.realmsAwakened();
  const ratio = awakened / 5;
  const circumference = 2 * Math.PI * 18;
  dom.progressFill.style.strokeDasharray = String(circumference);
  dom.progressFill.style.strokeDashoffset = String(circumference * (1 - ratio));
  dom.progressLabel.textContent = String(awakened);
  dom.questProgress.textContent = `${awakened} / 5`;
  const line = ELEMENT_LINES[awakened] || ELEMENT_LINES[0];
  if (dom.landingProgress) dom.landingProgress.textContent = `${awakened} / 5`;
  if (dom.landingProgressLine) dom.landingProgressLine.textContent = line;
  const realms = Store.state.session?.realms || [];
  dom.realmPips.innerHTML = REALM_ORDER.map((realm) => {
    const on = realms.some((r) => r.realm === realm && r.complete);
    return `<img class="realmPip ${on ? 'is-on' : ''}" src="${realmPfp(realm)}" alt="${REALM_META[realm].label}">`;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* shrine                                                                     */
/* -------------------------------------------------------------------------- */

function challengeHtml(station) {
  const type = station.challengeType;
  const challenge = station.challenge || {};
  if (!type || station.complete && station.type === 'guardian') {
    return station.type === 'guardian' && station.complete
      ? `<div class="challenge"><p class="challenge__prompt">This element is awake. Find the others, then scan the Winter Keeper Throne.</p></div>`
      : '';
  }

  if (type === 'code_entry') {
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
      <div class="challenge__row">
        ${challenge.fieldLabel ? `<p class="challenge__field">${escapeHtml(challenge.fieldLabel)}</p>` : ''}
        <input class="challenge__input" data-challenge-code inputmode="latin" autocapitalize="characters"
               autocomplete="off" spellcheck="false" maxlength="24" placeholder="${escapeHtml(challenge.placeholder || 'WORD')}">
        <button class="textButton textButton--play" data-challenge-submit type="button">${escapeHtml(challenge.submitLabel || 'Go')}</button>
      </div>
    </div>`;
  }

  if (type === 'image_select') {
    const need = Number(challenge.selectCount) || 3;
    const tiles = (challenge.images || []).map((img) => {
      const url = img.url || TILE_ART[img.id] || '';
      return `<button class="pickTile${url ? ' pickTile--art' : ''}" data-image-id="${escapeHtml(img.id)}" type="button" aria-pressed="false" style="--tile:${escapeHtml(img.color || '#5df0cf')}">
        ${url ? `<img src="${escapeHtml(url)}" alt="">` : ''}
        <span>${escapeHtml(img.label || img.id)}</span>
      </button>`;
    }).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}" data-select-count="${need}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
      <p class="challenge__count" data-pick-count role="status" aria-live="polite">0 of ${need} selected</p>
      <p class="challenge__error" data-pick-error hidden role="alert">Choose three images</p>
      <div class="pickGrid">${tiles}</div>
      <button class="textButton textButton--play" data-image-submit type="button">Check my three</button>
    </div>`;
  }

  if (type === 'sequence' || type === 'multi_sequence') {
    const opts = (challenge.options || []).map((opt) => {
      const id = opt.id || opt;
      const label = opt.label || opt;
      const color = opt.color || '';
      const art = challenge.kind === 'color'
        ? LANTERN_ART[id]
        : (REALM_META[id] ? realmPad(id) : '');
      return `<button class="seqBtn${art ? ' seqBtn--art' : ''}" data-seq="${escapeHtml(id)}" type="button" style="${color ? `--tile:${escapeHtml(color)}` : ''}">
        ${art ? `<img src="${escapeHtml(art)}" alt="">` : ''}
        <span>${escapeHtml(label)}</span>
      </button>`;
    }).join('');
    const len = challenge.length || 5;
    const slots = Array.from({ length: len }, () =>
      '<span class="seqSlot" data-seq-slot><span class="seqSlot__dot"></span></span>'
    ).join('');
    const clearLabel = challenge.clearLabel || 'Clear';
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}" data-seq-len="${len}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
      ${challenge.kind === 'color'
        ? `<div class="seqSlots" data-seq-readout style="--slots:${len}" aria-label="Chosen lanterns">${slots}</div>`
        : '<p class="seqReadout" data-seq-readout>Tap the sequence</p>'}
      <div class="seqRow">${opts}</div>
      <button class="${challenge.clearLabel ? 'challenge__clear' : 'textButton'}" data-seq-clear type="button">${escapeHtml(clearLabel)}</button>
      ${challenge.submitLabel ? `<button class="textButton textButton--play" data-seq-submit type="button">${escapeHtml(challenge.submitLabel)}</button>` : ''}
    </div>`;
  }

  if (type === 'shape_match') {
    const trayPieces = [...(challenge.pieces || [])];
    for (let i = trayPieces.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [trayPieces[i], trayPieces[j]] = [trayPieces[j], trayPieces[i]];
    }
    const pieces = trayPieces.map((piece) => `
      <button class="runePiece" type="button" data-piece="${escapeHtml(piece.id)}" data-fits="${piece.fits ? '1' : '0'}">
        ${runeShapeSvg(piece.id, 'tray')}
        <span>${escapeHtml(piece.label || '')}</span>
      </button>`).join('');
    return `<div class="challenge runePlay" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      <div class="runeAltar" data-rune-altar>
        <div class="runeAltar__mark" aria-hidden="true">${RUNE_FULL}</div>
        <div class="runeAltar__set" data-rune-set></div>
        <p class="runeAltar__hint">Drag the five pieces here</p>
      </div>
      <div class="runeTray">${pieces}</div>
    </div>`;
  }

  if (type === 'quiz') {
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}" data-quiz-step="0">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      <div data-quiz-card>${quizCardHtml(station, 0, null)}</div>
      <button class="textButton" data-quiz-skip type="button">Skip the quiz</button>
    </div>`;
  }

  return '';
}

function shrineMeetTitle(station) {
  if (station.type === 'guardian') return 'Meet the Guardian';
  if (station.type === 'monument') return 'Meet the First Builder';
  if (station.type === 'heart') return 'The Winter Keeper Throne';
  return `Meet ${station.title}`;
}

function formatRealmList(realms) {
  const names = (realms || []).map((r) => REALM_META[r]?.label || r).filter(Boolean);
  if (!names.length) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function heartRemainingRealms(heartResult) {
  if (Array.isArray(heartResult?.remaining) && heartResult.remaining.length) {
    return heartResult.remaining;
  }
  return (Store.state.session?.realms || []).filter((r) => !r.complete).map((r) => r.realm);
}

function heartIntroHtml(session, heartResult) {
  if (session?.winterKeeper) {
    return storyHtml('Your quest is complete. Show this screen at the Gift Shop for your Winter Keeper medallion.');
  }
  const remaining = heartRemainingRealms(heartResult);
  if (remaining.length) {
    const list = formatRealmList(remaining);
    const count = remaining.length;
    const sleeping = count === 5
      ? 'None of the five elements are awake yet'
      : count === 1
        ? `One element is still sleeping (${list})`
        : `${count} elements are still sleeping (${list})`;
    return storyHtml(
      `The Winter Keeper Throne is the final scan — not a shortcut. ${sleeping}. Return here after you awaken ${count === 1 ? 'it' : 'them'} to confirm your quest and earn the Winter Keeper title.`
    );
  }
  return storyHtml(
    'All five elements are awake. Scan the Winter Keeper Throne now to confirm your quest is complete. You will be named Winter Keeper, Protector of Winter Magic. An optional group photo here is welcome. Then show the completion screen at the Gift Shop for your medallion.'
  );
}

function shrineDiscoverTitle(station) {
  if (station.type === 'guardian') return 'Discover the Element';
  if (station.type === 'monument') return 'How Ice Castles Grow';
  return 'Discover';
}

function quizCardHtml(station, step, picked) {
  const questions = station.challenge?.questions || [];
  const q = questions[step];
  if (!q) return '';
  if (picked == null) {
    const choices = (q.choices || []).map((choice, index) =>
      `<button class="quizChoice" type="button" data-quiz-choice="${index}">${escapeHtml(choice)}</button>`
    ).join('');
    return `<p class="quizQ__ask">${escapeHtml(q.question)}</p><div class="quizChoices">${choices}</div>`;
  }
  const index = Number.isFinite(Number(q.correctIndex)) ? Number(q.correctIndex) : 0;
  const letter = 'ABCD'[index] || '';
  const correct = q.choices?.[index] || '';
  const last = step >= questions.length - 1;
  return `<p class="quizQ__ask">${escapeHtml(q.question)}</p>
    <p class="quizReveal__answer">Correct answer: ${escapeHtml(letter)}. ${escapeHtml(correct)}</p>
    <p class="quizReveal__fact">${escapeHtml(q.fact || '')}</p>
    <button class="textButton textButton--play" data-quiz-next type="button">${last ? 'Finish quiz' : 'Next question'}</button>`;
}

function storyHtml(text) {
  const parts = String(text || '').split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return parts.map((part) => `<p>${escapeHtml(part)}</p>`).join('');
}

const LISTEN_ICON = `<svg class="listenButton__icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 9.5v5h3.6L13 19V5L7.6 9.5H4z" fill="currentColor"/>
  <path d="M16 9.2a4.2 4.2 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M18.4 6.8a7.2 7.2 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`;

function hearthHtml() {
  const src = `${ART}/ember-flames.mp4?v=2`;
  return `<video class="hearth__src" src="${src}" muted playsinline preload="auto" aria-hidden="true"></video>
    <video class="hearth__src" src="${src}" muted playsinline preload="auto" aria-hidden="true"></video>
    <canvas class="hearth" aria-hidden="true"></canvas>`;
}

function realmSkyHtml(element) {
  if (element === 'fire') {
    const embers = '<span class="ember"></span>'.repeat(14);
    return `<div class="realmSky" aria-hidden="true">${hearthHtml()}${embers}</div>`;
  }
  if (element === 'air') return airSkyHtml();
  if (element === 'earth') return earthSkyHtml();
  if (element === 'spirit') return spiritSkyHtml();
  return `<div class="realmSky" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
}

function spiritSkyHtml() {
  const stars = [
    ['11%', '12%', '5px', '#ffffff', '1.05s', '-0.2s'],
    ['24%', '20%', '3px', '#d7b4ff', '1.35s', '-0.7s'],
    ['38%', '9%', '4px', '#7ef3ff', '1.15s', '-0.4s'],
    ['52%', '18%', '7px', '#fff4c8', '1.55s', '-1.1s'],
    ['67%', '11%', '3px', '#b8ffd4', '1.2s', '-0.3s'],
    ['81%', '16%', '5px', '#ffb7e8', '1.4s', '-0.9s'],
    ['16%', '36%', '4px', '#c9a6ff', '1.25s', '-0.5s'],
    ['33%', '44%', '3px', '#9af7ff', '1.1s', '-1.3s'],
    ['48%', '34%', '6px', '#ffffff', '1.6s', '-0.15s'],
    ['61%', '42%', '3px', '#e7ffb0', '1.3s', '-0.85s'],
    ['76%', '33%', '4px', '#ff9ad8', '1.45s', '-1.6s'],
    ['90%', '40%', '3px', '#d7b4ff', '1.2s', '-0.55s'],
  ];
  const marks = stars.map(([x, y, s, c, t, d]) =>
    `<i style="--x:${x};--y:${y};--s:${s};--c:${c};--t:${t};--d:${d}"></i>`
  ).join('');
  const veils = '<span></span>'.repeat(6);
  return `<div class="realmSky" aria-hidden="true"><div class="borealis" aria-hidden="true">${veils}</div>${marks}</div>`;
}

let windField = null;

function airSkyHtml() {
  return `<div class="realmSky" aria-hidden="true"><canvas class="wind" aria-hidden="true"></canvas></div>`;
}

function earthSkyHtml() {
  return `<div class="realmSky" aria-hidden="true"><canvas class="leaves" aria-hidden="true"></canvas></div>`;
}

const LEAF_COLORS = ['#6ea84a', '#c4a15a', '#3f7a34', '#8f6a32', '#d2c06a', '#4e8a3e'];
let leafField = null;

function createLeafFall(canvas, paused) {
  const ctx = canvas.getContext('2d');
  const AIR = 12;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let running = false;
  let last = 0;
  let built = false;
  let bins = 1;
  let maxH = 120;
  let heights = [0];
  const falling = [];
  const pile = [];

  function layout() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width || canvas.clientWidth || 0);
    const h = Math.round(rect.height || canvas.clientHeight || 0);
    if (w < 2 || h < 2) return false;
    const next = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(w * next);
    const bh = Math.round(h * next);
    if (canvas.width !== bw || canvas.height !== bh || dpr !== next) {
      canvas.width = bw;
      canvas.height = bh;
      dpr = next;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const resized = width !== w;
    width = w;
    height = h;
    if (resized || !built) {
      bins = Math.max(12, Math.round(w / 18));
      maxH = Math.min(200, h * 0.2);
      heights = Array(bins).fill(0);
      built = false;
    }
    return true;
  }

  function spawnX() {
    const u = (Math.random() + Math.random() + Math.random()) / 3;
    return width * (0.16 + u * 0.68);
  }

  function launch(leaf, fromTop) {
    leaf.x = spawnX();
    leaf.y = fromTop ? -24 - Math.random() * 90 : Math.random() * height;
    leaf.vy = 72 + Math.random() * 58;
    leaf.sway = 14 + Math.random() * 26;
    leaf.freq = 0.7 + Math.random() * 1.1;
    leaf.phase = Math.random() * Math.PI * 2;
    leaf.rot = Math.random() * Math.PI * 2;
    leaf.spin = (Math.random() - 0.5) * 2.4;
    leaf.w = 16 + Math.random() * 12;
    leaf.h = leaf.w * (1.05 + Math.random() * 0.35);
    leaf.color = LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0];
  }

  function groundAt(x) {
    const f = (x / width) * (bins - 1);
    const i = Math.max(0, Math.min(bins - 2, Math.floor(f)));
    const t = f - i;
    return height - 26 - (heights[i] * (1 - t) + heights[i + 1] * t);
  }

  function settle(x, y, leaf) {
    const landed = {
      x: Math.max(10, Math.min(width - 10, x + (Math.random() - 0.5) * 14)),
      y: y + (Math.random() - 0.5) * 5,
      rot: leaf.rot,
      w: leaf.w,
      h: leaf.h,
      color: leaf.color,
    };
    if (pile.length >= 150) {
      const start = (pile.length * 0.5) | 0;
      pile[start + ((Math.random() * (pile.length - start)) | 0)] = landed;
      return;
    }
    pile.push(landed);
    const i = Math.max(0, Math.min(bins - 1, Math.round((x / width) * (bins - 1))));
    const gain = 6 + Math.random() * 4;
    heights[i] = Math.min(maxH, heights[i] + gain);
    if (i > 0) heights[i - 1] = Math.min(maxH, heights[i - 1] + gain * 0.38);
    if (i < bins - 1) heights[i + 1] = Math.min(maxH, heights[i + 1] + gain * 0.38);
  }

  function step(dt) {
    for (const leaf of falling) {
      leaf.y += leaf.vy * dt;
      leaf.rot += leaf.spin * dt;
      const drift = Math.sin(leaf.y * 0.012 + leaf.phase) * leaf.sway;
      const x = leaf.x + drift;
      const ground = groundAt(x);
      if (leaf.y >= ground) {
        settle(x, ground, leaf);
        launch(leaf, true);
      }
    }
  }

  function drawLeaf(leaf) {
    ctx.save();
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.rot);
    ctx.fillStyle = leaf.color;
    ctx.beginPath();
    ctx.moveTo(0, -leaf.h * 0.5);
    ctx.quadraticCurveTo(leaf.w * 0.72, -leaf.h * 0.08, 0, leaf.h * 0.5);
    ctx.quadraticCurveTo(-leaf.w * 0.72, leaf.h * 0.08, 0, -leaf.h * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(48, 62, 24, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -leaf.h * 0.38);
    ctx.lineTo(0, leaf.h * 0.38);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const settled = pile.slice().sort((a, b) => a.y - b.y);
    for (const leaf of settled) drawLeaf(leaf);
    for (const leaf of falling) {
      const drift = Math.sin(leaf.y * 0.012 + leaf.phase) * leaf.sway;
      drawLeaf({ ...leaf, x: leaf.x + drift });
    }
  }

  function prime() {
    falling.length = 0;
    pile.length = 0;
    heights.fill(0);
    for (let i = 0; i < AIR; i += 1) {
      const leaf = {};
      launch(leaf, false);
      falling.push(leaf);
    }
    let guard = 0;
    while (pile.length < 140 && guard < 4000) {
      step(0.05);
      guard += 1;
    }
    built = true;
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    if (!layout()) {
      raf = window.requestAnimationFrame(frame);
      return;
    }
    if (!built) prime();
    const hidden = document.hidden || (typeof paused === 'function' && paused());
    if (!hidden) {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      step(dt);
    } else last = 0;
    draw();
    raf = window.requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      document.addEventListener('visibilitychange', onHide);
      raf = window.requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      document.removeEventListener('visibilitychange', onHide);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };

  function onHide() {
    if (document.hidden) last = 0;
  }
}

function stopLeaves() {
  if (!leafField) return;
  leafField.stop();
  leafField = null;
}

function startLeaves() {
  stopLeaves();
  const canvas = document.querySelector('.realmSky .leaves');
  if (!canvas) return;
  leafField = createLeafFall(canvas, () => (
    document.body.classList.contains('map-moving')
    || document.body.classList.contains('guide-open')
    || document.body.classList.contains('landing-open')
  ));
  leafField.start();
}

function stopWind() {
  if (!windField) return;
  windField.stop();
  windField = null;
}

function startWind() {
  stopWind();
  const canvas = document.querySelector('.realmSky .wind');
  if (!canvas || typeof createWindWisps !== 'function') return;
  windField = createWindWisps(canvas, {
    direction: 0,
    speed: 1,
    density: 1,
    color: '#f4fbff',
    opacity: 0.8,
    trail: 1,
    spiral: 0.25,
    paused() {
      return document.body.classList.contains('map-moving')
        || document.body.classList.contains('guide-open')
        || document.body.classList.contains('landing-open');
    },
  });
  windField.start();
}

function listenButtonHtml(src) {
  const audio = src ? `<audio preload="none" src="${escapeHtml(src)}"></audio>` : '';
  return `<button class="listenButton" type="button" data-listen aria-pressed="false" aria-label="Play this story">
    ${LISTEN_ICON}<span class="listenButton__label">Listen</span>
  </button>
  ${audio}`;
}

let storyAudio = null;

function setListenButton(button, on) {
  button.classList.toggle('is-on', on);
  button.setAttribute('aria-pressed', on ? 'true' : 'false');
  button.setAttribute('aria-label', on ? 'Stop the recording' : 'Play this story');
  const label = button.querySelector('.listenButton__label');
  if (label) label.textContent = on ? 'Stop' : 'Listen';
}

function stopStoryAudio() {
  if (storyAudio) {
    storyAudio.pause();
    try { storyAudio.currentTime = 0; } catch { /* not loaded yet */ }
    storyAudio = null;
  }
  document.querySelectorAll('[data-listen].is-on').forEach((button) => setListenButton(button, false));
}

function playStory(button) {
  const audio = button.nextElementSibling;
  if (!(audio instanceof HTMLAudioElement)) return;
  if (button.classList.contains('is-on')) {
    stopStoryAudio();
    return;
  }
  stopStoryAudio();
  storyAudio = audio;
  setListenButton(button, true);
  audio.onended = () => {
    if (storyAudio !== audio) return;
    storyAudio = null;
    setListenButton(button, false);
  };
  audio.play().catch(() => {
    if (storyAudio === audio) storyAudio = null;
    setListenButton(button, false);
    toast('Couldn’t play that recording.');
  });
}

let hearthGen = 0;

function stopHearth() {
  hearthGen += 1;
  document.querySelectorAll('.hearth__src').forEach((video) => video.pause());
}

function punchGreen(data, width, height) {
  const count = width * height;
  const solid = new Uint8Array(count);
  for (let p = 0, i = 0; p < count; p += 1, i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const spill = g - Math.max(r, b);
    if (spill > 8 || data[i + 3] < 16) {
      data[i + 3] = 0;
    } else {
      if (spill > 0) data[i + 1] = Math.max(r, b);
      solid[p] = 1;
    }
  }
  const erode = (src) => {
    const dst = new Uint8Array(count);
    for (let y = 1; y < height - 1; y += 1) {
      const row = y * width;
      for (let x = 1; x < width - 1; x += 1) {
        const p = row + x;
        if (src[p] && src[p - 1] && src[p + 1] && src[p - width] && src[p + width]) dst[p] = 1;
      }
    }
    return dst;
  };
  const inner = erode(erode(solid));
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const p = row + x;
      const i = p * 4 + 3;
      if (!inner[p]) {
        data[i] = 0;
        continue;
      }
      const edge = !inner[p - 1] || !inner[p + 1] || !inner[p - width] || !inner[p + width];
      data[i] = edge ? 160 : 255;
    }
  }
  for (let x = 0; x < width; x += 1) data[x * 4 + 3] = data[((height - 1) * width + x) * 4 + 3] = 0;
  for (let y = 0; y < height; y += 1) data[(y * width) * 4 + 3] = data[(y * width + width - 1) * 4 + 3] = 0;
}

const HEARTH_BLEND = 0.85;

function blendHearth(dst, src, mix) {
  const keep = 1 - mix;
  for (let i = 0; i < dst.length; i += 4) {
    const lead = dst[i + 3] * keep;
    const follow = src[i + 3] * mix;
    const out = lead + follow;
    if (out < 1) {
      dst[i + 3] = 0;
      continue;
    }
    dst[i] = (dst[i] * lead + src[i] * follow) / out;
    dst[i + 1] = (dst[i + 1] * lead + src[i + 1] * follow) / out;
    dst[i + 2] = (dst[i + 2] * lead + src[i + 2] * follow) / out;
    dst[i + 3] = out;
  }
}

function startHearth() {
  const canvas = document.querySelector('.realmSky .hearth');
  const videos = [...document.querySelectorAll('.realmSky .hearth__src')];
  let primary = videos[0];
  let secondary = videos[1] || null;
  if (!canvas || !primary) return;
  const gen = ++hearthGen;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scratch = document.createElement('canvas');
  const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
  let lit = false;
  let bridging = false;
  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = false;
    video.playsInline = true;
  });
  const play = (video) => {
    if (video && video.paused && !video.ended && video.readyState >= 2) video.play().catch(() => {});
  };
  const paint = () => {
    if (gen !== hearthGen || !canvas.isConnected) return;
    try {
    const held = document.body.classList.contains('map-moving')
      || document.body.classList.contains('guide-open')
      || document.body.classList.contains('landing-open');
    if (held) {
      videos.forEach((video) => { if (!video.paused) video.pause(); });
    } else {
      play(primary);
      if (bridging) play(secondary);
    }
    if (!held && primary.readyState >= 2 && primary.videoWidth) {
      const dur = primary.duration;
      const blend = Number.isFinite(dur) ? Math.min(HEARTH_BLEND, dur * 0.2) : 0;
      const remaining = Number.isFinite(dur) ? dur - primary.currentTime : Infinity;
      if (secondary && blend > 0.2 && remaining <= blend && !bridging && !primary.ended) {
        bridging = true;
        const into = Math.max(0, blend - remaining);
        const begin = () => {
          if (gen !== hearthGen || !bridging) return;
          play(secondary);
        };
        if (Math.abs(secondary.currentTime - into) > 0.05) {
          secondary.addEventListener('seeked', begin, { once: true });
          try { secondary.currentTime = into; } catch { begin(); }
        } else begin();
      }
      const vw = primary.videoWidth;
      const vh = primary.videoHeight;
      const cropTop = Math.round(vh * 0.30);
      const cropBottom = Math.round(vh * 0.955);
      const cropH = cropBottom - cropTop;
      const scale = Math.min(1, 640 / vw);
      const w = Math.round(vw * scale);
      const h = Math.round(cropH * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(primary, 0, cropTop, vw, cropH, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h);
      punchGreen(frame.data, w, h);
      const still = Number.isFinite(dur) ? dur - primary.currentTime : Infinity;
      if (bridging && secondary && secondary.readyState >= 2 && secondary.videoWidth && still <= blend) {
        if (scratch.width !== w || scratch.height !== h) {
          scratch.width = w;
          scratch.height = h;
        }
        const sw = secondary.videoWidth;
        const sh = secondary.videoHeight;
        scratchCtx.drawImage(secondary, 0, Math.round(sh * 0.30), sw, Math.round(sh * 0.955) - Math.round(sh * 0.30), 0, 0, w, h);
        const incoming = scratchCtx.getImageData(0, 0, w, h);
        punchGreen(incoming.data, w, h);
        blendHearth(frame.data, incoming.data, Math.min(1, Math.max(0, (blend - still) / blend)));
      }
      ctx.putImageData(frame, 0, 0);
      if (primary.ended || (bridging && remaining <= 0.03)) {
        if (secondary && bridging && secondary.readyState >= 2 && secondary.currentTime > 0.01) {
          const outgoing = primary;
          primary = secondary;
          secondary = outgoing;
          bridging = false;
          secondary.pause();
          try { secondary.currentTime = 0; } catch { /* next blend seeks again */ }
        } else if (primary.ended) {
          bridging = false;
          try { primary.currentTime = 0; } catch { /* replay from the start */ }
          primary.play().catch(() => {});
        }
      }
      if (!lit) {
        lit = true;
        const rise = canvas.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 900, easing: 'ease', fill: 'forwards' },
        );
        rise.onfinish = () => {
          canvas.style.opacity = '1';
          rise.cancel();
        };
      }
      }
    } catch {
      /* keep the next frame coming if one paint fails */
    }
    requestAnimationFrame(paint);
  };
  const boot = () => {
    if (gen !== hearthGen) return;
    primary.play().catch(() => {});
    if (secondary) {
      secondary.play().then(() => {
        if (gen !== hearthGen || bridging) return;
        secondary.pause();
        try { secondary.currentTime = 0; } catch { /* kept warm */ }
      }).catch(() => {});
    }
    requestAnimationFrame(paint);
  };
  if (primary.readyState >= 2) boot();
  else primary.addEventListener('loadeddata', boot, { once: true });
}

function renderStation(slug) {
  stopStoryAudio();
  stopHearth();
  stopWind();
  stopLeaves();
  if (!document.body.classList.contains('landing-open')) haltWaves();
  const station = Store.touchBySlug(slug) || Store.touchByType('threshold')[0];
  if (!station) {
    delete document.body.dataset.realm;
    dom.stationView.innerHTML = `<div class="empty"><p class="empty__title">This station isn’t on tonight’s quest.</p></div>`;
    return;
  }
  if (station.type === 'guardian' && station.element) document.body.dataset.realm = station.element;
  else delete document.body.dataset.realm;

  if (shrineSlug !== station.slug) {
    shrineSlug = station.slug;
    // Keep Meet/Discover/Play when history restore asked for this station's section.
    if (history.state?.station === station.slug && history.state?.view === 'shrine' && history.state?.focus) {
      shrineFocus = history.state.focus;
    } else {
      shrineFocus = null;
    }
  }

  const gated = station.type === 'guardian' || station.type === 'monument';
  const playHtml = station.challengeType ? challengeHtml(station) : '';
  const extra = station.type === 'monument' && Store.state.session?.builderQuizAt
    ? `<p class="fineprint">You finished the builder quiz. This stop is optional.</p>`
    : '';
  const art = stationArt(station);
  const portrait = station.element ? realmCharacter(station.element) : '';
  const sky = station.type === 'guardian' ? realmSkyHtml(station.element) : '';
  const waveRealm = station.type === 'guardian' && REALM_META[station.element]?.wave ? station.element : '';
  const artHtml = art ? summonHtml(art, 'shrine__art', station.element, { hero: Boolean(waveRealm) }) : '';

  if (!gated) {
    const intro = station.type === 'heart'
      ? heartIntroHtml(Store.state.session)
      : storyHtml(station.body);
    dom.stationView.innerHTML = `
      <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
        <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
        <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
        ${artHtml}
        <section class="shrine__block">
          <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
          ${intro}
        </section>
        ${station.type !== 'heart' && station.discoverBody ? `<section class="shrine__block">
          <h3>${escapeHtml(shrineDiscoverTitle(station))}</h3>
          ${storyHtml(station.discoverBody)}
        </section>` : ''}
        <div id="heartSlot"></div>
      </article>`;
    if (station.type === 'heart') renderHeartSlot();
    armSummons(dom.stationView);
    return;
  }

  dom.stationView.innerHTML = `
    <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
      ${sky}
      <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
      <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
      ${station.element ? `<p class="chip chip--target">${escapeHtml(REALM_META[station.element]?.label || station.element)}</p>` : ''}
      ${artHtml}
      <div class="shrineGate" data-focus="">
        <button class="shrineIcon" data-shrine-focus="meet" type="button" aria-expanded="false">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_MEET}</span>
          <span class="shrineIcon__label">Meet</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="discover" type="button" aria-expanded="false">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_DISCOVER}</span>
          <span class="shrineIcon__label">Discover</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="play" type="button" aria-expanded="false">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem shrineIcon__gem--play">${ICON_PLAY}</span>
          <span class="shrineIcon__label">Play</span>
        </button>
      </div>
      <section class="shrinePanel" data-panel="meet">
        <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
        ${station.type === 'guardian' ? listenButtonHtml(station.audioUrl) : ''}
        ${portrait ? summonHtml(portrait, 'shrine__portrait', station.element) : ''}
        ${storyHtml(station.body)}
      </section>
      <section class="shrinePanel" data-panel="discover">
        <h3>${escapeHtml(shrineDiscoverTitle(station))}</h3>
        ${station.type === 'guardian' ? listenButtonHtml(station.discoverAudioUrl) : ''}
        ${storyHtml(station.discoverBody || 'Look around this shrine. The castle keeps its own clues.')}
      </section>
      <section class="shrinePanel" data-panel="play" id="challenge">
        <h3>Play the challenge</h3>
        ${playHtml}
        ${extra}
      </section>
    </article>`;

  selectedImages = new Set();
  sequenceBuffer = [];
  document.querySelector('.shrine')?.classList.toggle('is-play-open', shrineFocus === 'play');
  if (shrineFocus) setShrineFocus(shrineFocus, { spin: false, scroll: false, restore: true });
  armSummons(dom.stationView);
  if (waveRealm && !document.body.classList.contains('landing-open')) armShrineWaves(waveRealm);
  if (station.element === 'fire') startHearth();
  if (station.element === 'air') startWind();
  if (station.element === 'earth') startLeaves();
}

async function openStation(slug, { recordVisit = true } = {}) {
  hideThreshold();
  hideMapModal();
  closePanels();
  closeGuide({ force: true });
  Store.setIntendedStation(slug);
  markHistoryView(slug, 'shrine', shrineFocus);
  Store.state.path = Store.pathContext();
  renderStation(slug);
  if (recordVisit && Store.hasLiveSession() && slug) {
    try { await Store.visitStation(slug); renderProgress(); } catch { /* offline */ }
    if (slug === 'heart' || Store.touchBySlug(slug)?.type === 'heart') {
      const result = await Store.scanHeart();
      const station = Store.touchBySlug(slug);
      if (station) {
        const block = dom.stationView.querySelector('.shrine__block');
        if (block) {
          const title = block.querySelector('h3');
          block.innerHTML = `${title ? title.outerHTML : `<h3>${escapeHtml(shrineMeetTitle(station))}</h3>`}${heartIntroHtml(Store.state.session, result)}`;
        }
      }
      renderHeartSlot(result);
    }
  }
}

function renderHeartSlot(heartResult) {
  const slot = el('heartSlot');
  if (!slot) return;
  const session = Store.state.session;
  if (!session?.live) return;

  if (session.winterKeeper) {
    slot.innerHTML = staffScreenHtml(session);
    return;
  }

  const remaining = heartRemainingRealms(heartResult);

  if (remaining.length) {
    const icons = remaining.map((r) =>
      `<li><img src="${realmPfp(r)}" alt=""><span>${escapeHtml(REALM_META[r]?.label || r)}</span></li>`
    ).join('');
    const list = formatRealmList(remaining);
    slot.innerHTML = `<div class="challenge">
      <p class="challenge__prompt">Still needed: ${escapeHtml(list)}. Finish ${remaining.length === 1 ? 'that Guardian challenge' : 'those Guardian challenges'}, then return here to scan and confirm.</p>
      <ul class="remainList">${icons}</ul>
      <button class="textButton" data-open-journey type="button">View my journey</button>
    </div>`;
    return;
  }

  if (!throneRevealPlayed) {
    throneRevealPlayed = true;
    openThroneReveal();
  }
  slot.innerHTML = keepersFormHtml();
}

function keepersFormHtml() {
  const known = Store.state.session?.partySize;
  const sizeField = known
    ? `<p class="fineprint">Party of ${known}.</p>`
    : `<label>How many adventurers?
      <input class="challenge__input" name="partySize" type="number" min="1" max="20" value="1" required>
    </label>`;
  return `<form class="challenge keepers" id="keepersForm">
    <p class="challenge__prompt">Water, Earth, Fire, Air, and Spirit are awake. You completed all five Guardian challenges, and the Throne confirms your quest is complete. You are Winter Keepers, Protectors of Winter Magic. Enter your first names for your recognition.</p>
    ${sizeField}
    <label>First names
      <input class="challenge__input" name="names" placeholder="Ada, Sam, Juniper" required>
    </label>
    <label>Email for a digital copy of your Winter Keeper recognition (optional)
      <input class="challenge__input" name="email" type="email" autocomplete="email">
    </label>
    <button class="threshold__primary threshold__primary--earned" type="submit">Become Winter Keepers</button>
  </form>`;
}

function staffScreenHtml(session) {
  const names = session.keeperNames || [];
  const park = Store.state.park || {};
  const count = session.partySize || names.length || 1;
  return `<div class="staffCard">
    <p class="staffCard__kicker">Gift Shop</p>
    <h3>Winter Keeper medallion</h3>
    <p class="staffCard__names">${escapeHtml(names.join(' · ') || 'This party')}</p>
    <p class="staffCard__count">Winter Keepers in this party: ${count}</p>
    <p class="fineprint">${escapeHtml(park.badgeRedemption || 'Show this screen at the Gift Shop to receive your Winter Keeper medallion.')}</p>
  </div>`;
}

function sealHtml(session) {
  const names = (session.keeperNames || []).join(', ') || 'Winter Keepers';
  const park = Store.state.park || {};
  const year = Store.state.adventure?.year || '';
  return `<div class="seal">
    <img class="seal__art" src="${ART}/seal-winter-keeper.png" alt="">
    <img class="seal__wordmark" src="${ART}/wordmark-winter-keeper.png" alt="Winter Keeper">
    <h2 class="seal__names">${escapeHtml(names)}</h2>
    <p class="seal__meta">${escapeHtml(park.locationName || park.name || '')} · ${escapeHtml(String(year))}</p>
  </div>`;
}

async function submitKeepers(form) {
  const names = String(form.names.value || '').split(/[,;/]+/).map((n) => n.trim()).filter(Boolean);
  const partySize = Store.state.session?.partySize || Number(form.partySize?.value || names.length || 1);
  await Store.finishQuest({
    names,
    partySize,
    email: form.email.value || null,
    marketingOptIn: false,
  });
  renderProgress();
  renderHeartSlot();
  showFinale();
}

let throneRevealPlayed = false;

function openThroneReveal() {
  const pieces = REALM_ORDER.map((id, index) =>
    `<img class="combine__piece combine__piece--${id}" src="${realmIcon(id, true)}" alt="" style="--i:${index}">`
  ).join('');
  dom.finaleCard.innerHTML = `
    <div class="finaleStage combine">
      <div class="combine__stage" aria-hidden="true">
        ${pieces}
        <span class="combine__burst"></span>
        <img class="combine__medal" src="${ART}/seal-winter-keeper.png" alt="">
      </div>
      <p class="combine__kicker">Winter Keeper</p>
      <h2 class="combine__title">Protector of Winter Magic</h2>
      <p class="finaleStage__lead">The five elements rush together, and the Winter Keeper medallion appears.</p>
      <p class="combine__photo">If you like, take a group photo here at the Throne. That part is entirely optional.</p>
      <button class="threshold__primary threshold__primary--earned finaleStage__btn" data-close-finale type="button">Continue</button>
    </div>`;
  dom.finale.hidden = false;
  requestAnimationFrame(() => dom.finale.classList.add('is-open'));
}

function showFinale() {
  const session = Store.state.session;
  if (!session?.winterKeeper) return;
  dom.finaleCard.innerHTML = `
    <div class="finaleStage finaleStage--staff">
      ${staffScreenHtml(session)}
      <button class="textButton finaleStage__btn" data-close-finale type="button">Done</button>
    </div>`;
  dom.finale.hidden = false;
  requestAnimationFrame(() => dom.finale.classList.add('is-open'));
}

function showReward() {
  const session = Store.state.session;
  dom.finaleCard.innerHTML = `
    <div class="finaleStage finaleStage--staff">
      ${staffScreenHtml(session)}
      <button class="textButton finaleStage__btn" data-close-finale type="button">Done</button>
    </div>`;
}

function hideFinale() {
  dom.finale.classList.remove('is-open');
  setTimeout(() => { dom.finale.hidden = true; }, 320);
  if (Store.state.session?.winterKeeper) renderHeartSlot();
}

/* -------------------------------------------------------------------------- */
/* journey dashboard                                                          */
/* -------------------------------------------------------------------------- */

function renderJourney() {
  const stations = Store.state.touchpoints || [];
  const session = Store.state.session;
  const rows = stations.map((tp) => {
    let status = 'Visit';
    if (tp.type === 'heart') status = session?.winterKeeper ? 'Complete' : session?.realmsComplete ? 'Ready to scan' : 'Final destination';
    else if (tp.type === 'monument') status = session?.builderQuizAt ? 'Quiz done' : session?.buildersVisitedAt ? 'Visited' : 'Optional';
    else if (tp.type === 'threshold') status = session ? 'Welcome' : 'Start here';
    else if (tp.complete) status = 'Element awake';
    const awake = Boolean(tp.complete || (tp.type === 'heart' && session?.winterKeeper));
    const realm = tp.element ? ` data-realm="${escapeHtml(tp.element)}"` : '';
    const hint = tp.element ? `${REALM_META[tp.element]?.label || tp.element} · ${status}` : status;
    let token;
    if (tp.element) token = `<img src="${realmPfp(tp.element)}" alt="">`;
    else token = `<img src="${STATION_ICON[tp.type] || `${ART}/ui/icon-journey.svg`}" alt="">`;
    return `<li>
      <button class="stop${awake ? ' is-found' : ''}"${realm} data-kind="${escapeHtml(tp.type || '')}" data-go-station="${escapeHtml(tp.slug)}" type="button">
        <span class="stop__token">${token}</span>
        <span class="stop__copy">
          <p class="stop__name">${escapeHtml(tp.title)}</p>
          <p class="stop__hint">${escapeHtml(hint)}</p>
        </span>
      </button>
    </li>`;
  }).join('');

  const awakened = Store.realmsAwakened();
  dom.journeyBody.innerHTML = `
    <div class="journeyHead">
      <p class="journeyHead__count"><b>${awakened}</b><span>/ 5</span></p>
      <p class="journeyHead__note">${escapeHtml(ELEMENT_LINES[awakened] || ELEMENT_LINES[0])} Builder’s Monument is optional.</p>
    </div>
    <ul class="stopList">${rows}</ul>`;
}

function openPanel(name) {
  closeGuide();
  panelTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  ['journeyPanel', 'passportPanel'].forEach((key) => {
    if (!dom[key]) return;
    dom[key].classList.remove('is-open');
    dom[key].hidden = true;
    dom[key].inert = true;
  });
  if (name === 'journey') { renderJourney(); showPanel(dom.journeyPanel); }
  else if (name === 'passport') { renderPassport(); showPanel(dom.passportPanel); }
  currentPanel = name;
  document.body.classList.add('panel-open');
}

function showPanel(panel) {
  panel.inert = false;
  panel.hidden = false;
  requestAnimationFrame(() => {
    panel.classList.add('is-open');
    panel.querySelector('.panel__close')?.focus();
  });
}

function closePanels() {
  const trigger = panelTrigger;
  ['journeyPanel', 'passportPanel'].forEach((key) => {
    if (!dom[key]) return;
    dom[key].classList.remove('is-open');
    dom[key].inert = true;
    // Hide immediately so closed panels leave the a11y tree / tab order.
    dom[key].hidden = true;
  });
  currentPanel = null;
  panelTrigger = null;
  document.body.classList.remove('panel-open');
  if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
    requestAnimationFrame(() => trigger.focus());
  }
}

function renderPassport() {
  const session = Store.state.session;
  const park = Store.state.park || {};
  dom.passportBody.innerHTML = session?.winterKeeper
    ? `${staffScreenHtml(session)}<p class="fineprint">${escapeHtml(park.badgeBody || '')}</p>`
    : `<div class="empty">
        <h3 class="empty__title">Not a Winter Keeper yet</h3>
        <p class="empty__body">Awaken five elements, then scan the Winter Keeper Throne. Progress lasts until 4 AM Eastern.</p>
      </div>`;
}

/* -------------------------------------------------------------------------- */
/* threshold / guide                                                          */
/* -------------------------------------------------------------------------- */

const LANDING_FACTS = {
  water: [
    { who: 'Cascade', text: 'Cascade notices water’s smallest wonders.' },
    { who: 'Cascade', text: 'A bubble, a ripple, a reflection. The smallest detail may hold the biggest wonder.' },
    { who: 'Cascade', text: 'Every Ice Castle begins and ends with water.' },
  ],
  earth: [
    { who: 'Granite', text: 'Granite remembers the ground beneath the ice.' },
    { who: 'Granite', text: 'The castle begins with a place to build and a plan for people to move through it.' },
    { who: 'Granite', text: 'Notice what supports the magic, not only what sparkles above it.' },
  ],
  fire: [
    { who: 'Ember', text: 'Ember finds balance in cold and light.' },
    { who: 'Ember', text: 'Light reveals color, bubbles, and texture that daylight may hide.' },
    { who: 'Ember', text: 'Fire and ice can share a story without one conquering the other.' },
  ],
  air: [
    { who: 'Summit', text: 'Summit follows the wind.' },
    { who: 'Summit', text: 'Watch a flag flutter, snow drift, or warm breath appear in the cold.' },
    { who: 'Summit', text: 'Curiosity moves like the wind. It carries you toward something you had not noticed yet.' },
  ],
  spirit: [
    { who: 'Aurora', text: 'Aurora gathers the memories people carry away.' },
    { who: 'Aurora', text: 'What lasts is the fond memories people carry with them.' },
    { who: 'Aurora', text: 'Wonder can continue as a memory, long after the ice has changed.' },
  ],
};

const talkCursor = { water: 0, earth: 0, fire: 0, air: 0, spirit: 0 };
let talkDelay = 0;
let talkPulse = 0;
let talkHide = 0;

/* -------------------------------------------------------------------------- */
/* guardian wave clips — muted, one at a time                                */
/* -------------------------------------------------------------------------- */

let waveGen = 0;
let waveTimer = 0;
let waveRaf = 0;
const WAVE_STILL_S = 0.25;

function waveStillEl(paintHost, mode) {
  return mode === 'face'
    ? paintHost.querySelector('img')
    : paintHost.querySelector('.shrine__art');
}

function primeWaveStill(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.style.transition = 'none';
  el.style.opacity = '1';
}

function fadeWaveStill(el, to, seconds) {
  if (!el) return;
  el.style.transition = `opacity ${Math.max(0.05, seconds)}s linear`;
  el.style.opacity = String(to);
}

function clearWaveStill(el) {
  if (!el) return;
  el.style.opacity = '';
  el.style.transition = '';
  el.style.animation = '';
}

function waveVideoEl() {
  if (waveVideoEl.el) return waveVideoEl.el;
  const video = document.createElement('video');
  video.className = 'waveSource';
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  document.body.appendChild(video);
  waveVideoEl.el = video;
  return video;
}

function silenceWave(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
  try {
    const tracks = video.audioTracks;
    if (tracks) {
      for (let i = 0; i < tracks.length; i += 1) tracks[i].enabled = false;
    }
  } catch { /* not supported */ }
}

function isBackdrop(r, g, b) {
  const m = r > g ? (r > b ? r : b) : (g > b ? g : b);
  // Near-black only. Granite's fur is dark brown and shares an edge with the
  // vignette, so a wider match eats his legs.
  return m < 18;
}

function keyBackdrop(image) {
  const { data, width: w, height: h } = image;
  const count = w * h;
  if (keyBackdrop.n !== count) {
    keyBackdrop.n = count;
    keyBackdrop.bg = new Uint8Array(count);
    keyBackdrop.qx = new Int16Array(count);
    keyBackdrop.qy = new Int16Array(count);
  }
  const bg = keyBackdrop.bg;
  bg.fill(0);
  const qx = keyBackdrop.qx;
  const qy = keyBackdrop.qy;
  let qe = 0;
  let qs = 0;
  const push = (x, y) => {
    const p = y * w + x;
    if (bg[p]) return;
    const i = p * 4;
    if (!isBackdrop(data[i], data[i + 1], data[i + 2])) return;
    bg[p] = 1;
    qx[qe] = x;
    qy[qe] = y;
    qe += 1;
  };
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    if (h > 1) push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    if (w > 1) push(w - 1, y);
  }
  while (qs < qe) {
    const x = qx[qs];
    const y = qy[qs];
    qs += 1;
    if (x > 0) push(x - 1, y);
    if (x + 1 < w) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < h) push(x, y + 1);
  }
  // Black showing through a pose, such as the gap between Ember's face and
  // raised arm, or between a wing and the tail. Those pockets never reach
  // the frame edge, so the flood above leaves them. Pupils are smaller.
  if (!keyBackdrop.seen || keyBackdrop.seen.length !== count) {
    keyBackdrop.seen = new Uint8Array(count);
    keyBackdrop.stack = new Int32Array(count);
    keyBackdrop.comp = new Int32Array(count);
  }
  const seen = keyBackdrop.seen;
  const stack = keyBackdrop.stack;
  const comp = keyBackdrop.comp;
  seen.fill(0);
  const minPocket = Math.max(12, Math.round(count * 0.00085));
  for (let start = 0; start < count; start += 1) {
    if (bg[start] || seen[start]) continue;
    const s0 = start * 4;
    if (Math.max(data[s0], data[s0 + 1], data[s0 + 2]) >= 24) continue;
    let sp = 0;
    let cp = 0;
    let touchLinks = 0;
    let pure = 0;
    const x0 = start % w;
    const y0 = (start / w) | 0;
    let minX = x0;
    let maxX = x0;
    let minY = y0;
    let maxY = y0;
    stack[sp] = start;
    sp += 1;
    seen[start] = 1;
    while (sp) {
      sp -= 1;
      const q = stack[sp];
      comp[cp] = q;
      cp += 1;
      const qi = q * 4;
      const qm = data[qi] > data[qi + 1]
        ? (data[qi] > data[qi + 2] ? data[qi] : data[qi + 2])
        : (data[qi + 1] > data[qi + 2] ? data[qi + 1] : data[qi + 2]);
      if (qm < 8) pure += 1;
      const x = q % w;
      const y = (q / w) | 0;
      if (x < minX) minX = x;
      else if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      else if (y > maxY) maxY = y;
      let ni = x > 0 ? q - 1 : -1;
      if (ni >= 0 && bg[ni]) touchLinks += 1;
      else if (ni >= 0 && !seen[ni]) {
        const o = ni * 4;
        if (Math.max(data[o], data[o + 1], data[o + 2]) < 24) {
          seen[ni] = 1;
          stack[sp] = ni;
          sp += 1;
        }
      }
      ni = x + 1 < w ? q + 1 : -1;
      if (ni >= 0 && bg[ni]) touchLinks += 1;
      else if (ni >= 0 && !seen[ni]) {
        const o = ni * 4;
        if (Math.max(data[o], data[o + 1], data[o + 2]) < 24) {
          seen[ni] = 1;
          stack[sp] = ni;
          sp += 1;
        }
      }
      ni = y > 0 ? q - w : -1;
      if (ni >= 0 && bg[ni]) touchLinks += 1;
      else if (ni >= 0 && !seen[ni]) {
        const o = ni * 4;
        if (Math.max(data[o], data[o + 1], data[o + 2]) < 24) {
          seen[ni] = 1;
          stack[sp] = ni;
          sp += 1;
        }
      }
      ni = y + 1 < h ? q + w : -1;
      if (ni >= 0 && bg[ni]) touchLinks += 1;
      else if (ni >= 0 && !seen[ni]) {
        const o = ni * 4;
        if (Math.max(data[o], data[o + 1], data[o + 2]) < 24) {
          seen[ni] = 1;
          stack[sp] = ni;
          sp += 1;
        }
      }
    }
    // A pose hole is flat black: the opening between Ember's head and wing,
    // or a wing and a tail. Pupils and open mouths are black too, but they
    // stay under about 86% pure and the long side stays short. Granite's
    // scarf is dark green rather than empty black.
    const frame = w < h ? w : h;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const shortSide = bw < bh ? bw : bh;
    const longSide = bw > bh ? bw : bh;
    const pureRatio = pure / cp;
    const chunky = bw >= frame * 0.07 && bh >= frame * 0.07;
    const open = shortSide >= frame * 0.03 && longSide >= frame * 0.04;
    const neck = Math.max(8, Math.round(frame * 0.03));
    const hole = cp >= minPocket && pureRatio >= 0.86
      && (touchLinks === 0 || touchLinks <= neck)
      && (chunky || open);
    if (hole) {
      for (let k = 0; k < cp; k += 1) bg[comp[k]] = 1;
    }
  }
  // Dark fringe clinging to the silhouette. Only pixels that touch the
  // backdrop qualify, and only for a couple of pixels, so the body and face stay.
  if (!keyBackdrop.rim || keyBackdrop.rim.length !== count) {
    keyBackdrop.rim = new Int32Array(count);
  }
  const rim = keyBackdrop.rim;
  const rimLimit = 52;
  for (let depth = 0; depth < 2; depth += 1) {
    let n = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const p = y * w + x;
        if (bg[p]) continue;
        if (!(bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w])) continue;
        const i = p * 4;
        const m = data[i] > data[i + 1]
          ? (data[i] > data[i + 2] ? data[i] : data[i + 2])
          : (data[i + 1] > data[i + 2] ? data[i + 1] : data[i + 2]);
        if (m < rimLimit) {
          rim[n] = p;
          n += 1;
        }
      }
    }
    for (let k = 0; k < n; k += 1) bg[rim[k]] = 1;
  }
  for (let p = 0; p < count; p += 1) {
    if (bg[p]) data[p * 4 + 3] = 0;
  }
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const p = y * w + x;
      if (bg[p]) continue;
      if (!(bg[p - 1] || bg[p + 1] || bg[p - w] || bg[p + w])) continue;
      const i = p * 4;
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      if (m < 42) data[i + 3] = Math.round((m / 42) * 255);
    }
  }
  return image;
}

function paintWaveFrame(canvas, video, mode, realm) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;
  ctx.clearRect(0, 0, w, h);
  if (mode === 'face') {
    const crop = WAVE_FACE[realm] || { zoom: 0.74, top: 0.02 };
    const side = vw * crop.zoom;
    ctx.drawImage(video, (vw - side) / 2, vh * crop.top, side, side, 0, 0, w, h);
  } else {
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  ctx.putImageData(keyBackdrop(ctx.getImageData(0, 0, w, h)), 0, 0);
}

function sizeWaveCanvas(canvas, cssW, cssH) {
  const maxEdge = cssH > 140 ? 420 : 240;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.max(2, Math.round(cssW * dpr));
  let h = Math.max(2, Math.round(cssH * dpr));
  const edge = Math.max(w, h);
  if (edge > maxEdge) {
    const fit = maxEdge / edge;
    w = Math.max(2, Math.round(w * fit));
    h = Math.max(2, Math.round(h * fit));
  }
  canvas.width = w;
  canvas.height = h;
}

function loadWave(video, realm) {
  const src = REALM_META[realm]?.wave;
  if (!src) return Promise.reject(new Error('wave'));
  silenceWave(video);
  if (video.getAttribute('data-src') === src && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('wave')); };
    const cleanup = () => {
      video.removeEventListener('loadeddata', ok);
      video.removeEventListener('error', bad);
    };
    video.addEventListener('loadeddata', ok);
    video.addEventListener('error', bad);
    video.setAttribute('data-src', src);
    video.src = src;
    video.load();
  });
}

function haltWaves() {
  waveGen += 1;
  window.clearTimeout(waveTimer);
  window.cancelAnimationFrame(waveRaf);
  waveRaf = 0;
  const video = waveVideoEl.el;
  if (video) {
    video.onended = null;
    video.pause();
    silenceWave(video);
  }
  document.querySelectorAll('.is-waving').forEach((node) => node.classList.remove('is-waving'));
  document.querySelectorAll('.landing__wave, .shrine__wave').forEach((node) => node.remove());
  document.querySelectorAll('.landing__face img, .shrine__hero .shrine__art').forEach((el) => clearWaveStill(el));
}

async function runWave(realm, mode, paintHost, wavingHost, gen) {
  const video = waveVideoEl();
  silenceWave(video);
  await loadWave(video, realm);
  if (gen !== waveGen || !paintHost.isConnected) return false;
  silenceWave(video);
  if (video.currentTime > 0.04) {
    await new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
      try { video.currentTime = 0; } catch { resolve(); }
    });
  }
  if (gen !== waveGen || !paintHost.isConnected) return false;
  const canvas = document.createElement('canvas');
  canvas.className = mode === 'face' ? 'landing__wave' : 'shrine__wave';
  canvas.setAttribute('aria-hidden', 'true');
  paintHost.appendChild(canvas);
  if (mode === 'face') sizeWaveCanvas(canvas, paintHost.offsetWidth, paintHost.offsetHeight);
  else {
    const img = paintHost.querySelector('.shrine__art');
    sizeWaveCanvas(canvas, img?.offsetWidth || paintHost.offsetWidth, img?.offsetHeight || paintHost.offsetHeight);
  }
  if (canvas.width < 2 || canvas.height < 2) {
    canvas.remove();
    return false;
  }
  const still = waveStillEl(paintHost, mode);
  primeWaveStill(still);
  if (still) void still.offsetWidth;
  paintWaveFrame(canvas, video, mode, realm);
  wavingHost.classList.add('is-waving');
  try {
    await video.play();
  } catch {
    wavingHost.classList.remove('is-waving');
    clearWaveStill(still);
    canvas.remove();
    return false;
  }
  silenceWave(video);
  fadeWaveStill(still, 0, WAVE_STILL_S);
  let outroAt = 0;
  let outroMs = WAVE_STILL_S * 1000;
  let outroTimer = 0;
  const armOutro = () => {
    if (outroAt || gen !== waveGen) return;
    window.clearTimeout(outroTimer);
    const dur = video.duration;
    const remain = Number.isFinite(dur) ? Math.max(0, dur - (video.currentTime || 0)) : WAVE_STILL_S;
    const seconds = remain > 0.08 ? Math.min(WAVE_STILL_S, remain) : WAVE_STILL_S;
    outroMs = seconds * 1000;
    outroAt = performance.now();
    fadeWaveStill(still, 1, seconds);
  };
  const planOutro = () => {
    if (outroAt || gen !== waveGen) return;
    const dur = video.duration;
    if (!Number.isFinite(dur)) return;
    const ms = (dur - (video.currentTime || 0) - WAVE_STILL_S) * 1000;
    window.clearTimeout(outroTimer);
    if (ms <= 0) armOutro();
    else outroTimer = window.setTimeout(armOutro, ms);
  };
  planOutro();
  const natural = await new Promise((resolve) => {
    let safety = 0;
    const finish = (ok) => {
      window.clearTimeout(safety);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('durationchange', planOutro);
      if (!outroAt) armOutro();
      window.clearTimeout(outroTimer);
      resolve(ok);
    };
    const onEnd = () => finish(gen === waveGen);
    const onPause = () => {
      if (gen !== waveGen || video.ended) finish(gen === waveGen && video.ended);
    };
    video.addEventListener('ended', onEnd);
    video.addEventListener('pause', onPause);
    video.addEventListener('durationchange', planOutro);
    safety = window.setTimeout(() => finish(false), 8000);
    const draw = () => {
      if (gen !== waveGen || !canvas.isConnected) return;
      if (!outroAt && Number.isFinite(video.duration) && video.duration - video.currentTime <= WAVE_STILL_S) {
        armOutro();
      }
      if (video.ended) return;
      if (!video.muted || video.volume !== 0) silenceWave(video);
      paintWaveFrame(canvas, video, mode, realm);
      waveRaf = window.requestAnimationFrame(draw);
    };
    waveRaf = window.requestAnimationFrame(draw);
  });
  if (gen === waveGen && !outroAt) armOutro();
  if (gen === waveGen && outroAt) {
    const left = outroMs - (performance.now() - outroAt);
    if (left > 20) await new Promise((resolve) => window.setTimeout(resolve, left));
  }
  window.clearTimeout(outroTimer);
  if (gen === waveGen && canvas.isConnected) canvas.remove();
  clearWaveStill(still);
  wavingHost.classList.remove('is-waving');
  return natural;
}

function landingCanWave() {
  return document.body.classList.contains('landing-open')
    && Boolean(dom.threshold?.classList.contains('is-open'))
    && !(dom.beginBrief && !dom.beginBrief.hidden);
}

function armLandWaves(realm) {
  const gen = waveGen;
  const again = async () => {
    if (gen !== waveGen || !landingCanWave()) return;
    const btn = document.querySelector(`.landing__realm.is-talking[data-realm="${realm}"]`);
    const face = btn?.querySelector('.landing__face');
    if (!btn || !face) return;
    let played = false;
    try { played = await runWave(realm, 'face', face, btn, gen); } catch { /* skip */ }
    if (!played || gen !== waveGen) return;
    if (!document.querySelector(`.landing__realm.is-talking[data-realm="${realm}"]`)) return;
    again();
  };
  again();
}

function armShrineWaves(realm) {
  const gen = waveGen;
  const tick = (delay) => {
    window.clearTimeout(waveTimer);
    waveTimer = window.setTimeout(async () => {
      if (gen !== waveGen) return;
      const hero = document.querySelector('.shrine__hero');
      if (!hero || document.body.dataset.realm !== realm) return;
      const shownAt = Number(hero.dataset.summonAt || 0);
      const summoning = hero.classList.contains('summon')
        && (!hero.classList.contains('is-shown') || performance.now() - shownAt < 760);
      if (summoning) {
        tick(280);
        return;
      }
      try { await runWave(realm, 'hero', hero, hero, gen); } catch { /* try later */ }
      if (gen !== waveGen) return;
      tick(11000 + Math.random() * 9000);
    }, delay);
  };
  tick(3800 + Math.random() * 2200);
}

function hideLandTalk() {
  document.querySelectorAll('.landing__realm.is-talking').forEach((n) => n.classList.remove('is-talking'));
  if (dom.landingTalk) dom.landingTalk.hidden = true;
  haltWaves();
}

function landTalk(realm, hold = 4800) {
  const facts = LANDING_FACTS[realm];
  if (!facts?.length || !dom.landingBubble || !dom.landingTalk) return;
  const fact = facts[talkCursor[realm] % facts.length];
  talkCursor[realm] += 1;
  document.querySelectorAll('.landing__realm.is-talking').forEach((n) => n.classList.remove('is-talking'));
  document.querySelector(`.landing__realm[data-realm="${realm}"]`)?.classList.add('is-talking');
  const slot = (REALM_ORDER.indexOf(realm) + 0.5) / REALM_ORDER.length * 100;
  dom.landingBubble.dataset.realm = realm;
  dom.landingBubble.style.setProperty('--tail', `${slot}%`);
  if (dom.landingBubbleWho) dom.landingBubbleWho.textContent = fact.who;
  if (dom.landingBubbleText) dom.landingBubbleText.textContent = fact.text;
  dom.landingTalk.hidden = false;
  dom.landingBubble.classList.remove('is-fresh');
  void dom.landingBubble.offsetWidth;
  dom.landingBubble.classList.add('is-fresh');
  window.clearTimeout(talkHide);
  talkHide = window.setTimeout(hideLandTalk, hold);
  haltWaves();
  armLandWaves(realm);
}

function startLandTalk() {
  stopLandTalk();
  talkDelay = window.setTimeout(() => {
    if (dom.threshold?.classList.contains('is-open')) landTalk('water');
    talkPulse = window.setInterval(() => {
      if (!dom.threshold?.classList.contains('is-open')) return;
      if (dom.beginBrief && !dom.beginBrief.hidden) return;
      const realm = REALM_ORDER[Math.floor(Math.random() * REALM_ORDER.length)];
      landTalk(realm);
    }, 7000);
  }, 1400);
}

function stopLandTalk() {
  window.clearTimeout(talkDelay);
  window.clearInterval(talkPulse);
  window.clearTimeout(talkHide);
  hideLandTalk();
}

/* Landing hero: one shared 941×1672 image-coordinate scene (photo + fx).
   Cover scale = max(cw/941, ch/1672), then center; bias framing to keep
   lanterns in view when cover allows. Effects stay glued to the scene. */
const LANDING_SCENE_W = 941;
const LANDING_SCENE_H = 1672;
const LANDING_LANTERN = {
  left: { x: 0.096, y: 0.682 },
  right: { x: 0.903, y: 0.682 },
};
let landingSceneObserver = null;
let landingSceneRaf = 0;

function landingFxDebugEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get('fxdebug') === '1') return true;
    if (window.localStorage?.getItem('cqLandingFxDebug') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

function syncLandingFxPause() {
  const gate = dom.landingGate;
  if (!gate) return;
  const pause = document.hidden || !document.body.classList.contains('landing-open');
  gate.classList.toggle('is-fx-paused', pause);
}

function fitLandingScene() {
  const gate = dom.landingGate;
  const scene = dom.landingScene;
  if (!gate || !scene) return;
  const cw = gate.clientWidth;
  const ch = gate.clientHeight;
  if (cw < 2 || ch < 2) return;

  const scale = Math.max(cw / LANDING_SCENE_W, ch / LANDING_SCENE_H);
  const w = LANDING_SCENE_W * scale;
  const h = LANDING_SCENE_H * scale;
  let left = (cw - w) / 2;
  let top = (ch - h) / 2;

  /* When the cover crop has slack on an axis, nudge framing so lantern
     centers stay inside the viewport instead of sliding off with the art. */
  const minLeft = Math.min(0, cw - w);
  const minTop = Math.min(0, ch - h);
  const pad = Math.min(18, Math.max(8, Math.min(cw, ch) * 0.03));

  if (w > cw + 0.5) {
    const lx = left + LANDING_LANTERN.left.x * w;
    const rx = left + LANDING_LANTERN.right.x * w;
    const leftOut = lx < pad;
    const rightOut = rx > cw - pad;
    /* Only nudge when one lantern is clipped and the other still has room.
       If both are clipped (very narrow cover), centered remains best. */
    if (leftOut && !rightOut) left += pad - lx;
    else if (rightOut && !leftOut) left -= rx - (cw - pad);
    left = Math.min(0, Math.max(minLeft, left));
  }
  if (h > ch + 0.5) {
    /* Prefer a mid-low focus so sky aurora and lanterns share the frame. */
    const focusY = 0.56;
    top = ch * 0.5 - h * focusY;
    const ly = top + LANDING_LANTERN.left.y * h;
    if (ly < pad) top += pad - ly;
    else if (ly > ch - pad) top -= ly - (ch - pad);
    top = Math.min(0, Math.max(minTop, top));
  }

  scene.style.width = `${w}px`;
  scene.style.height = `${h}px`;
  scene.style.transform = `translate(${left}px, ${top}px)`;
  /* Keep fx + debug locked to the same image-space box as the photo.
     Fx uses left/top (not transform) so Spirit-style screen-blend veils work. */
  [dom.landingFx, dom.landingFxDebug].forEach((layer) => {
    if (!layer) return;
    layer.style.width = `${w}px`;
    layer.style.height = `${h}px`;
    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
    layer.style.transform = 'none';
  });
}

function scheduleLandingSceneFit() {
  if (landingSceneRaf) return;
  landingSceneRaf = window.requestAnimationFrame(() => {
    landingSceneRaf = 0;
    fitLandingScene();
  });
}

function initLandingScene() {
  const gate = dom.landingGate;
  if (!gate || !dom.landingScene) return;
  const debugOn = landingFxDebugEnabled();
  gate.classList.toggle('is-fx-debug', debugOn);
  if (dom.landingFxDebug) dom.landingFxDebug.hidden = !debugOn;
  fitLandingScene();
  syncLandingFxPause();
  if (!landingSceneObserver && typeof ResizeObserver === 'function') {
    landingSceneObserver = new ResizeObserver(() => scheduleLandingSceneFit());
    landingSceneObserver.observe(gate);
  }
  window.addEventListener('orientationchange', scheduleLandingSceneFit);
  document.addEventListener('visibilitychange', syncLandingFxPause);
}

function showThreshold() {
  const park = Store.state.park || {};
  if (dom.landingPlace) {
    dom.landingPlace.textContent = park.locationName || park.name || 'Ice Castles';
  }
  if (dom.landingProgress) {
    const awakened = Store.realmsAwakened();
    dom.landingProgress.textContent = `${awakened} / 5`;
    if (dom.landingProgressLine) dom.landingProgressLine.textContent = ELEMENT_LINES[awakened] || ELEMENT_LINES[0];
  }
  hideBeginBrief();
  clearPartyReminder();
  const known = Store.state.session?.partySize;
  if (dom.landingPartySize && known && !String(dom.landingPartySize.value || '').trim()) {
    dom.landingPartySize.value = String(known);
  }
  document.body.classList.add('landing-open');
  dom.threshold.hidden = false;
  dom.threshold.inert = false;
  dom.threshold.classList.add('is-open');
  scheduleLandingSceneFit();
  syncLandingFxPause();
  startLandTalk();
}

function readPartySize() {
  const raw = String(dom.landingPartySize?.value || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) return null;
  return n;
}

function clearPartyReminder() {
  dom.landingPartyHint?.classList.remove('is-on');
  dom.landingParty?.classList.remove('is-nudge');
  dom.landingPartySize?.removeAttribute('aria-invalid');
  dom.landingPartySize?.removeAttribute('aria-errormessage');
  if (dom.landingPartyHint) {
    dom.landingPartyHint.setAttribute('role', 'status');
    dom.landingPartyHint.textContent = 'Enter your party size to continue.';
  }
}

function remindPartySize() {
  const raw = String(dom.landingPartySize?.value || '').trim();
  const message = raw
    ? 'Enter a party size from 1 to 20.'
    : 'Enter your party size to continue.';
  if (dom.landingPartyHint) {
    dom.landingPartyHint.textContent = message;
    dom.landingPartyHint.setAttribute('role', 'alert');
    dom.landingPartyHint.classList.add('is-on');
  }
  dom.landingPartySize?.setAttribute('aria-invalid', 'true');
  dom.landingPartySize?.setAttribute('aria-errormessage', 'landingPartyHint');
  if (dom.landingParty) {
    dom.landingParty.classList.remove('is-nudge');
    void dom.landingParty.offsetWidth;
    dom.landingParty.classList.add('is-nudge');
  }
  dom.landingPartySize?.focus();
}

function hideStoryModal() {
  if (!dom.beginStory) return;
  dom.beginStory.hidden = true;
}

function openStoryModal() {
  if (!dom.beginStory) return;
  dom.beginStory.hidden = false;
}

function hideBeginBrief() {
  hideStoryModal();
  if (!dom.beginBrief) return;
  dom.beginBrief.hidden = true;
}

function openBeginBrief() {
  if (!readPartySize()) {
    remindPartySize();
    return;
  }
  clearPartyReminder();
  hideLandTalk();
  hideStoryModal();
  if (dom.beginBrief) {
    dom.beginBrief.hidden = false;
    dom.beginBrief.querySelector('.beginBrief__scroll')?.scrollTo(0, 0);
  }
}

function hideThreshold() {
  stopLandTalk();
  haltWaves();
  hideBeginBrief();
  document.body.classList.remove('landing-open');
  syncLandingFxPause();
  dom.threshold.classList.remove('is-open');
  dom.threshold.inert = true;
  setTimeout(() => { dom.threshold.hidden = true; }, 320);
}

async function enterFromLanding({ journeyMode }) {
  const partySize = readPartySize();
  if (!partySize) {
    hideBeginBrief();
    remindPartySize();
    return;
  }
  try {
    await Store.startSession(Store.intendedStation(), partySize);
  } catch {
    toast('Couldn’t start just yet. Try again in a moment.');
    return;
  }
  stripWelcomePreview();
  Store.setIntendedStation(null);
  if (!journeyMode) Store.showAllCategories();
  Store.setJourneyMode(journeyMode);
  goVenueHome();
  hideThreshold();
  renderProgress();
  openMapHome({ fit: journeyMode ? 'guardians' : 'park' });
}

function hideMapModal() {
  if (!dom.mapModal) return;
  mapModalMode = null;
  mapModalStation = null;
  if (dom.mapModalGuardians) {
    dom.mapModalGuardians.hidden = true;
    dom.mapModalGuardians.innerHTML = '';
  }
  dom.mapModal.classList.remove('is-open', 'mapModal--hint');
  dom.mapModal.inert = true;
  document.body.classList.remove('map-modal-open');
  setTimeout(() => {
    if (!dom.mapModal.classList.contains('is-open')) dom.mapModal.hidden = true;
  }, 280);
}

function renderBeginGuideGuardians() {
  if (!dom.mapModalGuardians) return;
  const guardians = Store.touchByType('guardian')
    .slice()
    .sort((a, b) => REALM_ORDER.indexOf(a.element) - REALM_ORDER.indexOf(b.element));
  if (!guardians.length) {
    dom.mapModalGuardians.hidden = true;
    dom.mapModalGuardians.innerHTML = '';
    return;
  }
  dom.mapModalGuardians.hidden = false;
  dom.mapModalGuardians.innerHTML = guardians.map((g) => {
    const realm = g.element || '';
    const name = g.title || REALM_META[realm]?.label || 'Guardian';
    const realmLabel = REALM_META[realm]?.label || '';
    const done = g.complete ? ' is-done' : '';
    return `<button class="mapModal__guardian${done}" type="button" data-slug="${escapeHtml(g.slug)}" aria-label="${escapeHtml(name)}">
      <span class="mapModal__face mapModal__face--${escapeHtml(realm)}"><img src="${realmPfp(realm)}" alt=""></span>
      <span class="mapModal__guardianName">${escapeHtml(realmLabel || name)}</span>
    </button>`;
  }).join('');
}

function showMapModal({ mode, eyebrow, title, body, primary, ghost, placement }) {
  mapModalMode = mode;
  dom.mapModalEyebrow.textContent = eyebrow;
  dom.mapModalTitle.textContent = title;
  if (mode === 'beginGuide') renderBeginGuideGuardians();
  else if (dom.mapModalGuardians) {
    dom.mapModalGuardians.hidden = true;
    dom.mapModalGuardians.innerHTML = '';
  }
  dom.mapModalBody.textContent = body;
  dom.mapModalPrimary.textContent = primary;
  dom.mapModalGhost.textContent = ghost || '';
  dom.mapModalGhost.hidden = !ghost;
  dom.mapModal.hidden = false;
  dom.mapModal.inert = false;
  dom.mapModal.classList.toggle('mapModal--hint', placement === 'hint');
  document.body.classList.add('map-modal-open');
  dom.mapModal.classList.add('is-open');
}

function showChoiceModal() {
  showMapModal({
    mode: 'choice',
    eyebrow: 'Castle Quest',
    title: 'Where to first?',
    body: 'Wander the whole castle, or begin the quest and pick a Guardian challenge.',
    primary: 'Begin the quest',
    ghost: 'Explore the map',
  });
}

function showBeginStationModal(station) {
  mapModalStation = station;
  showMapModal({
    mode: 'begin',
    eyebrow: station.subtitle || 'Guardian',
    title: station.title,
    body: 'Begin this shrine when you are ready.',
    primary: `Begin ${station.title}`,
    ghost: 'Stay on the map',
  });
}

function showBeginGuide() {
  showMapModal({
    mode: 'beginGuide',
    placement: 'hint',
    eyebrow: 'Begin Quest',
    title: 'Pick a Guardian',
    body: 'Tap a Guardian below, or walk to a glowing seal on the map to meet them and play their challenge.',
    primary: 'Got it',
  });
}

function frameGuardians(attempt = 0) {
  const ids = Store.guardianPoiIds();
  const points = Store.state.pois.filter((poi) => ids.has(poi.id));
  ParkMap.invalidate?.();
  const size = ParkMap.getMap?.()?.getSize?.();
  if ((!size || size.y < 40) && attempt < 6) {
    setTimeout(() => frameGuardians(attempt + 1), 50);
    return;
  }
  const card = document.querySelector('.mapModal.is-open .mapModal__card');
  const insetBottom = card ? Math.ceil(card.getBoundingClientRect().height) + 28 : 0;
  ParkMap.fitToPoints(points, { insetBottom });
}

function applyMapMode(on) {
  Store.setJourneyMode(on);
  renderMap();
  setTimeout(() => ParkMap.fit(), 80);
}

function handleMapModalPrimary() {
  if (mapModalMode === 'choice') {
    hideMapModal();
    applyMapMode(true);
    return;
  }
  if (mapModalMode === 'begin' && mapModalStation) {
    const slug = mapModalStation.slug;
    hideMapModal();
    goStation(slug);
    return;
  }
  if (mapModalMode === 'beginGuide') hideMapModal();
}

function handleMapModalGhost() {
  if (mapModalMode === 'choice') {
    hideMapModal();
    applyMapMode(false);
    return;
  }
  hideMapModal();
}

function openMapHome({ showChoice = false, fit = 'park' } = {}) {
  hideThreshold();
  if (!showChoice) hideMapModal();
  document.body.classList.toggle('begin-frame', fit === 'guardians');
  const welcome = Store.touchByType('threshold')[0];
  renderStation(welcome?.slug || 'threshold');
  openGuide();
  setTimeout(() => {
    ParkMap.invalidate?.();
    if (fit === 'guardians') frameGuardians();
    else ParkMap.fit();
  }, 80);
  if (showChoice) showChoiceModal();
  if (fit === 'guardians') {
    setTimeout(() => {
      if (!document.body.classList.contains('guide-open')) return;
      showBeginGuide();
      frameGuardians();
    }, 420);
  }
}

function showGuardianQrLanding(station) {
  hideThreshold();
  markHistoryView(station.slug, 'map-begin');
  Store.state.path = Store.pathContext();
  const welcome = Store.touchByType('threshold')[0];
  renderStation(welcome?.slug || 'threshold');
  openGuide();
  document.body.classList.remove('sheet-open');
  showBeginStationModal(station);
  setTimeout(() => {
    ParkMap.invalidate?.();
    if (station.poiId) ParkMap.focusOn(station.poiId, Store.state.pois, { zoom: 0.5, offsetY: 0.2 });
  }, 120);
}

function openGuide() {
  document.body.classList.add('guide-open');
  dom.guide.hidden = false;
  dom.guideToggle.setAttribute('aria-pressed', 'true');
  dom.guideToggle.textContent = 'Quest';
  dom.guideToggle.setAttribute('aria-label', 'Back to Castle Quest');
  if (dom.headerMap) dom.headerMap.setAttribute('aria-pressed', 'true');
  ensureMap();
  setTimeout(() => ParkMap.invalidate?.(), 80);
}

function closeGuide({ force = false } = {}) {
  if (!force && mapModalMode === 'choice') return;
  if (force || mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
  document.body.classList.remove('guide-open');
  document.body.classList.remove('sheet-open');
  dom.guide.hidden = true;
  dom.guideToggle.setAttribute('aria-pressed', 'false');
  dom.guideToggle.textContent = 'Quest';
  dom.guideToggle.setAttribute('aria-label', 'Back to Castle Quest');
  if (dom.headerMap) dom.headerMap.setAttribute('aria-pressed', 'false');
}

function ensureMap() {
  if (mapReady) {
    renderMap();
    return;
  }
  ParkMap.init(document.getElementById('map'), Store.state.map, {
    onSelect: (poiId) => {
      if (!poiId) {
        document.body.classList.remove('sheet-open');
        return;
      }
      const touch = Store.touchForPoi(poiId);
      if (Store.state.journeyMode && touch?.type === 'guardian') {
        document.body.classList.remove('sheet-open');
        goStation(touch.slug);
        return;
      }
      const poi = Store.poiById(poiId);
      if (poi) openPoiSheet(poi);
    },
  });
  mapReady = true;
  renderMap();
  renderLegend();
}

function renderMap() {
  if (!mapReady) return;
  const guardians = Store.guardianPoiIds();
  const completed = Store.completedGuardianPoiIds();
  const glowing = new Set([...guardians].filter((id) => !completed.has(id)));
  const realmByPoi = {};
  const markByPoi = {};
  (Store.state.touchpoints || []).forEach((tp) => {
    if (!tp.poiId) return;
    if (tp.element) realmByPoi[tp.poiId] = tp.element;
    else if (STATION_ICON[tp.type]) markByPoi[tp.poiId] = tp.type;
  });
  ParkMap.render(Store.state.pois, {
    scanned: Store.scannedIds(),
    targets: Store.state.journeyMode ? guardians : Store.journeyPoiIds(),
    hidden: Store.state.hiddenCategories,
    journeyOnly: Store.state.journeyMode,
    journeyIds: guardians,
    completed: Store.state.journeyMode ? completed : new Set(),
    glowing: Store.state.journeyMode ? glowing : new Set(),
    realmByPoi,
    markByPoi,
  });
  if (dom.journeyButton) {
    dom.journeyButton.setAttribute('aria-pressed', Store.state.journeyMode ? 'true' : 'false');
  }
}

function openPoiSheet(poi) {
  const touch = Store.touchForPoi(poi.id);
  dom.sheetBody.innerHTML = `
    <div>
      <p class="poi__eyebrow">${escapeHtml(poi.category)}</p>
      <h2 class="poi__name">${escapeHtml(poi.name)}</h2>
      ${poi.blurb ? `<p class="poi__blurb">${escapeHtml(poi.blurb)}</p>` : ''}
      ${poi.description ? `<p class="poi__body">${escapeHtml(poi.description)}</p>` : ''}
      ${touch ? `<button class="textButton" data-go-station="${escapeHtml(touch.slug)}" type="button">Open ${escapeHtml(touch.title)}</button>` : ''}
    </div>`;
  document.body.classList.add('sheet-open');
}

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || String(category || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function syncFilterChrome() {
  const hidden = Store.state.hiddenCategories?.size || 0;
  const filtering = hidden > 0;
  if (dom.filterButton) {
    dom.filterButton.classList.toggle('is-filtered', filtering);
    dom.filterButton.setAttribute(
      'aria-label',
      filtering ? `Filter map (${hidden} hidden)` : 'Filter what the map shows'
    );
  }
  if (dom.legendHint) {
    dom.legendHint.textContent = filtering
      ? `${hidden} categor${hidden === 1 ? 'y' : 'ies'} hidden`
      : 'All categories on';
    dom.legendHint.classList.toggle('is-filtered', filtering);
  }
}

function renderLegend() {
  const counts = {};
  Store.state.pois.forEach((poi) => {
    counts[poi.category] = (counts[poi.category] || 0) + 1;
  });
  const rows = Object.entries(counts).sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])));
  dom.legendRows.innerHTML = rows.map(([category, count]) => {
    const on = !Store.state.hiddenCategories.has(category);
    const label = categoryLabel(category);
    return `<button class="legend__row legend__row--${escapeHtml(category)}" data-category="${escapeHtml(category)}" aria-pressed="${on}" type="button">
      <span class="legend__gem" aria-hidden="true"></span>
      <span>${escapeHtml(label)}</span><span class="legend__count">${count}</span>
    </button>`;
  }).join('');
  syncFilterChrome();
}

function paintImagePick(root, { clearError = false } = {}) {
  if (!root) return;
  const need = Number(root.dataset.selectCount || 3);
  const count = selectedImages.size;
  root.querySelectorAll('[data-image-id]').forEach((btn) => {
    const on = selectedImages.has(btn.dataset.imageId);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const readout = root.querySelector('[data-pick-count]');
  if (readout) {
    readout.textContent = `${count} of ${need} selected`;
    readout.classList.toggle('is-ready', count === need);
  }
  if (clearError) {
    const err = root.querySelector('[data-pick-error]');
    if (err) err.hidden = true;
  }
}

/* -------------------------------------------------------------------------- */
/* awards                                                                     */
/* -------------------------------------------------------------------------- */

function enqueueAward(award) {
  awardQueue.push(award);
  if (!awardShowing) showNextAward();
}

function showNextAward() {
  const next = awardQueue.shift();
  if (!next) { awardShowing = false; return; }
  awardShowing = true;
  document.body.classList.add('award-open');
  dom.award.classList.toggle('is-final', Boolean(next.final));
  if (next.glyphUrl) {
    dom.awardGlyph.innerHTML = `<img src="${escapeHtml(next.glyphUrl)}" alt="">`;
  } else {
    dom.awardGlyph.textContent = next.glyph || '';
  }
  dom.awardKicker.textContent = next.kicker;
  dom.awardTitle.textContent = next.title;
  dom.awardMeta.textContent = next.meta;
  dom.awardDone.textContent = next.action || 'Keep exploring';
  const awakened = Store.realmsAwakened();
  dom.awardPips.innerHTML = Array.from({ length: 5 }, (_, i) =>
    `<span class="award__pip ${i < awakened ? 'is-on' : ''}"></span>`).join('');
  dom.award.hidden = false;
  requestAnimationFrame(() => dom.award.classList.add('is-open'));
  if (navigator.vibrate) navigator.vibrate(45);
}

function dismissAward() {
  dom.award.classList.remove('is-open');
  document.body.classList.remove('award-open');
  setTimeout(() => { dom.award.hidden = true; showNextAward(); }, 340);
}

async function handleStationChallenge(slug, answer) {
  const result = await Store.completeStation(slug, answer);
  if (result.status === 'error') {
    const station = Store.touchBySlug(slug);
    const messages = {
      bad_code: 'That word isn’t right. Try again.',
      bad_images: 'Not those three — look again at the ice.',
      bad_sequence: 'Not that order. Watch once more.',
      bad_shapes: 'These shapes have not found each other yet.',
    };
    toast(station?.challenge?.retry || messages[result.error] || 'Not quite — try again.');
    return;
  }
  renderProgress();
  renderStation(slug);
  renderMap();
  if (result.realmAwakened) {
    const meta = REALM_META[result.realmAwakened] || { label: result.realmAwakened, glyph: '✦' };
    enqueueAward({
      glyph: meta.glyph,
      glyphUrl: realmIcon(result.realmAwakened, true),
      kicker: 'Element Awakened',
      title: meta.label,
      meta: Store.touchBySlug(slug)?.challenge?.success || `${Store.realmsAwakened()} / 5`,
    });
  } else if (result.status === 'repeat') {
    toast('Already recorded.');
  } else {
    toast('Saved.', { warm: true });
  }
}

async function handleCode(code) {
  const result = await Store.scan(code);
  Scanner.close();
  if (result.status === 'unknown') return toast('That code isn’t one of ours.');
  if (result.status === 'invalid') return toast('Enter the printed code.');
  if (result.status === 'queued') return toast('Saved until you have signal.', { warm: true });
  if (result.poi) {
    ensureMap();
    openGuide();
    openPoiSheet(result.poi);
    const touch = Store.touchForPoi(result.poi.id);
    if (touch) toast(`${result.poi.name} — open the quest station if you like.`);
  }
}

/* -------------------------------------------------------------------------- */
/* routing                                                                    */
/* -------------------------------------------------------------------------- */

async function route() {
  Store.state.path = Store.pathContext();
  const slug = Store.state.path.station;
  const live = Store.hasLiveSession();

  if (!live || wantsWelcomePreview() || slug === 'threshold') {
    if (!live && slug && slug !== 'threshold') Store.setIntendedStation(slug);
    hideMapModal();
    closePanels();
    closeGuide({ force: true });
    showThreshold();
    const welcome = Store.touchByType('threshold')[0];
    renderStation(welcome?.slug || 'threshold');
    return;
  }

  hideThreshold();

  if (!slug) {
    Store.setIntendedStation(null);
    openMapHome();
    return;
  }

  const station = Store.touchBySlug(slug);
  if (station?.type === 'guardian' && !station.complete) {
    // Direct QR / fresh station URL → begin modal. History/reload after Begin
    // restores the shrine (and last Meet/Discover/Play section when known).
    if (history.state?.view === 'shrine' && history.state?.station === slug) {
      shrineFocus = history.state.focus || rememberedShrineFocus(slug) || shrineFocus;
      await openStation(slug);
      return;
    }
    showGuardianQrLanding(station);
    return;
  }

  await openStation(slug);
}

/* -------------------------------------------------------------------------- */
/* wiring                                                                     */
/* -------------------------------------------------------------------------- */

function bindFunButtons() {
  const skip = (btn) =>
    !btn || btn.disabled || btn.closest('.leaflet-container') || btn.classList.contains('landing__realm');

  const spark = (btn, event) => {
    if (btn.classList.contains('sheet__grip')) return;
    const pos = window.getComputedStyle(btn).position;
    if (pos === 'static') btn.classList.add('is-fun');
    const rect = btn.getBoundingClientRect();
    const x = (event.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (event.clientY || rect.top + rect.height / 2) - rect.top;
    const burst = document.createElement('span');
    burst.className = 'btnBurst';
    burst.setAttribute('aria-hidden', 'true');
    burst.style.setProperty('--x', `${x}px`);
    burst.style.setProperty('--y', `${y}px`);
    burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>';
    btn.appendChild(burst);
    window.setTimeout(() => burst.remove(), 560);
  };

  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const btn = event.target.closest('button');
    if (skip(btn)) return;
    btn.classList.add('is-pressed');
    spark(btn, event);
  });

  const release = () => {
    document.querySelectorAll('button.is-pressed').forEach((btn) => {
      btn.classList.remove('is-pressed');
      btn.classList.remove('is-pop');
      void btn.offsetWidth;
      btn.classList.add('is-pop');
    });
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  document.addEventListener('animationend', (event) => {
    if (event.animationName === 'btnPop') event.target.classList.remove('is-pop');
  });
}

function paintSequence(root) {
  if (!root) return;
  const slots = root.querySelectorAll('[data-seq-slot]');
  if (slots.length) {
    const buttons = [...root.querySelectorAll('[data-seq]')];
    slots.forEach((slot, index) => {
      const id = sequenceBuffer[index];
      slot.classList.toggle('is-filled', Boolean(id));
      slot.replaceChildren();
      if (!id) {
        const dot = document.createElement('span');
        dot.className = 'seqSlot__dot';
        slot.appendChild(dot);
        return;
      }
      const source = buttons.find((btn) => btn.dataset.seq === id)?.querySelector('img');
      if (source) {
        const img = source.cloneNode(true);
        img.alt = '';
        slot.appendChild(img);
        return;
      }
      const mark = document.createElement('span');
      mark.className = 'seqSlot__dot';
      slot.appendChild(mark);
    });
    return;
  }
  const readout = root.querySelector('[data-seq-readout]');
  if (!readout) return;
  readout.textContent = sequenceBuffer.length
    ? sequenceBuffer.map((id) => REALM_META[id]?.label || id).join(' → ')
    : 'Tap the sequence';
}

function wire() {
  bindFunButtons();
  initLandingScene();
  dom.progressButton.addEventListener('click', () => openPanel('journey'));
  const toggleGuide = () => {
    if (mapModalMode === 'choice') return;
    if (document.body.classList.contains('guide-open')) closeGuide();
    else openGuide();
  };
  dom.guideToggle.addEventListener('click', toggleGuide);
  if (dom.headerMap) dom.headerMap.addEventListener('click', toggleGuide);

  dom.thresholdStart.addEventListener('click', openBeginBrief);
  dom.landingMap?.addEventListener('click', () => enterFromLanding({ journeyMode: false }));
  dom.landingPartySize?.addEventListener('input', () => {
    if (readPartySize()) clearPartyReminder();
  });
  dom.beginContinue?.addEventListener('click', () => enterFromLanding({ journeyMode: true }));
  dom.beginBriefClose?.addEventListener('click', hideBeginBrief);
  dom.beginStoryOpen?.addEventListener('click', openStoryModal);
  dom.beginStoryClose?.addEventListener('click', hideStoryModal);
  dom.beginStory?.addEventListener('click', (event) => {
    if (event.target === dom.beginStory) hideStoryModal();
  });
  dom.landingRealms?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-realm]');
    if (!btn) return;
    landTalk(btn.dataset.realm);
  });
  dom.landingRealms?.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    const btn = event.target.closest('[data-realm]');
    if (!btn || btn.classList.contains('is-talking')) return;
    landTalk(btn.dataset.realm);
  }, true);

  dom.mapModalPrimary.addEventListener('click', handleMapModalPrimary);
  dom.mapModalGhost.addEventListener('click', handleMapModalGhost);
  dom.mapModalGuardians?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-slug]');
    if (!btn || mapModalMode !== 'beginGuide') return;
    goStation(btn.dataset.slug);
  });
  dom.mapModal.addEventListener('click', (event) => {
    if (event.target !== dom.mapModal) return;
    if (mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
  });

  dom.sheetGrip.addEventListener('click', () => document.body.classList.remove('sheet-open'));
  dom.recenter.addEventListener('click', () => {
    const framed = document.body.classList.contains('begin-frame');
    document.body.classList.remove('begin-frame');
    const refit = () => {
      ParkMap.invalidate?.();
      ParkMap.fit();
      toast('Whole park in view');
    };
    if (framed) setTimeout(refit, 40);
    else refit();
  });
  dom.journeyButton.addEventListener('click', () => {
    const on = Store.toggleJourneyMode();
    renderMap();
    toast(on ? 'Guardian stops only' : 'Full park map');
  });
  const closeLegend = () => {
    if (!dom.legend) return;
    dom.legend.hidden = true;
    dom.filterButton?.setAttribute('aria-expanded', 'false');
  };
  const openLegend = () => {
    if (!dom.legend) return;
    renderLegend();
    dom.legend.hidden = false;
    dom.filterButton?.setAttribute('aria-expanded', 'true');
  };
  dom.filterButton.addEventListener('click', () => {
    if (dom.legend.hidden) openLegend();
    else closeLegend();
  });
  el('legendClose')?.addEventListener('click', () => {
    closeLegend();
    dom.filterButton?.focus();
  });
  dom.legendRows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    Store.toggleCategory(button.dataset.category);
    renderLegend();
    renderMap();
  });
  dom.scanFab.addEventListener('click', () => Scanner.open(handleCode));
  dom.awardDone.addEventListener('click', () => {
    const goJourney = !dom.award.classList.contains('is-final');
    dismissAward();
    if (goJourney) openPanel('journey');
  });
  document.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', closePanels);
  });

  document.addEventListener('click', (event) => {
    const listen = event.target.closest('[data-listen]');
    if (listen) {
      playStory(listen);
      return;
    }
    const shrineBtn = event.target.closest('[data-shrine-focus]');
    if (shrineBtn) {
      setShrineFocus(shrineBtn.dataset.shrineFocus);
      return;
    }
    const go = event.target.closest('[data-go-station]');
    if (go) {
      closePanels();
      closeGuide();
      goStation(go.dataset.goStation);
      return;
    }
    if (event.target.closest('[data-open-journey]')) { openPanel('journey'); return; }
    if (event.target.closest('[data-show-reward]')) { showReward(); return; }
    if (event.target.closest('[data-close-finale]')) { hideFinale(); return; }

    const image = event.target.closest('[data-image-id]');
    if (image) {
      const root = image.closest('[data-station]');
      const need = Number(root?.dataset.selectCount || 3);
      const id = image.dataset.imageId;
      if (selectedImages.has(id)) {
        selectedImages.delete(id);
        paintImagePick(root, { clearError: true });
      } else if (selectedImages.size >= need) {
        const err = root?.querySelector('[data-pick-error]');
        if (err) {
          err.textContent = 'You already chose three. Deselect one to change.';
          err.hidden = false;
        }
        toast('Choose three images');
        paintImagePick(root);
      } else {
        selectedImages.add(id);
        paintImagePick(root, { clearError: true });
      }
      return;
    }
    if (event.target.closest('[data-image-submit]')) {
      const root = event.target.closest('[data-station]');
      const need = Number(root?.dataset.selectCount || 3);
      if (selectedImages.size !== need) {
        const err = root?.querySelector('[data-pick-error]');
        if (err) {
          err.textContent = need === 3 ? 'Choose three images' : `Choose ${need} images`;
          err.hidden = false;
        }
        toast(need === 3 ? 'Choose three images' : `Choose ${need} images`);
        paintImagePick(root);
        return;
      }
      paintImagePick(root, { clearError: true });
      handleStationChallenge(root.dataset.station, { ids: [...selectedImages] });
      return;
    }
    const seq = event.target.closest('[data-seq]');
    if (seq) {
      const root = seq.closest('[data-station]');
      const len = Number(root.dataset.seqLen || 5);
      if (sequenceBuffer.length >= len) return;
      sequenceBuffer.push(seq.dataset.seq);
      paintSequence(root);
      if (!root.querySelector('[data-seq-submit]') && sequenceBuffer.length >= len) {
        const answer = { sequence: [...sequenceBuffer] };
        sequenceBuffer = [];
        handleStationChallenge(root.dataset.station, answer);
      }
      return;
    }
    if (event.target.closest('[data-seq-clear]')) {
      sequenceBuffer = [];
      paintSequence(event.target.closest('[data-station]'));
      return;
    }
    if (event.target.closest('[data-seq-submit]')) {
      const root = event.target.closest('[data-station]');
      const len = Number(root.dataset.seqLen || 5);
      if (sequenceBuffer.length < len) {
        toast('Tap the full sequence first.');
        return;
      }
      const answer = { sequence: [...sequenceBuffer] };
      sequenceBuffer = [];
      paintSequence(root);
      handleStationChallenge(root.dataset.station, answer);
      return;
    }
    if (event.target.closest('[data-challenge-submit]')) {
      const root = event.target.closest('[data-station]');
      const code = root.querySelector('[data-challenge-code]')?.value;
      handleStationChallenge(root.dataset.station, { code });
      return;
    }
    if (event.target.closest('[data-quiz-choice]')) {
      const root = event.target.closest('[data-station]');
      const station = Store.touchBySlug(root.dataset.station);
      const step = Number(root.dataset.quizStep || 0);
      const card = root.querySelector('[data-quiz-card]');
      if (card) card.innerHTML = quizCardHtml(station, step, Number(event.target.closest('[data-quiz-choice]').dataset.quizChoice));
      return;
    }
    if (event.target.closest('[data-quiz-next]')) {
      const root = event.target.closest('[data-station]');
      const station = Store.touchBySlug(root.dataset.station);
      const questions = station?.challenge?.questions || [];
      const step = Number(root.dataset.quizStep || 0) + 1;
      if (step >= questions.length) {
        handleStationChallenge(root.dataset.station, { done: true });
        return;
      }
      root.dataset.quizStep = String(step);
      const card = root.querySelector('[data-quiz-card]');
      if (card) card.innerHTML = quizCardHtml(station, step, null);
      return;
    }
    if (event.target.closest('[data-quiz-skip]')) {
      toast('The quiz is optional. It does not change your quest.');
      return;
    }
  });

  let runeDrag = null;
  const releaseRunePiece = (piece) => {
    piece.classList.remove('is-dragging');
    piece.style.zIndex = '';
    piece.style.transform = '';
  };
  document.addEventListener('pointerdown', (event) => {
    const piece = event.target.closest('.runePiece');
    if (!piece || piece.classList.contains('is-placed')) return;
    if (piece.closest('.runeAltar.is-forged')) return;
    event.preventDefault();
    try { piece.setPointerCapture?.(event.pointerId); } catch { /* synthetic drags have no capture */ }
    runeDrag = {
      piece,
      pointerId: event.pointerId,
      root: piece.closest('[data-station]'),
      cx: event.clientX,
      cy: event.clientY,
    };
    piece.classList.add('is-dragging');
    piece.style.zIndex = '40';
  });
  document.addEventListener('pointermove', (event) => {
    if (!runeDrag || event.pointerId !== runeDrag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - runeDrag.cx;
    const dy = event.clientY - runeDrag.cy;
    runeDrag.piece.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const finishRuneDrag = (event) => {
    if (!runeDrag || event.pointerId !== runeDrag.pointerId) return;
    const { piece, root } = runeDrag;
    runeDrag = null;
    releaseRunePiece(piece);
    if (event.type === 'pointercancel') return;
    const altar = root?.querySelector('[data-rune-altar]');
    if (!altar || altar.classList.contains('is-forged')) return;
    const rect = altar.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) return;
    if (piece.dataset.fits !== '1') {
      const station = Store.touchBySlug(root.dataset.station);
      toast(station?.challenge?.retry || 'These shapes have not found each other yet.');
      piece.classList.add('is-rejected');
      setTimeout(() => piece.classList.remove('is-rejected'), 450);
      return;
    }
    const label = piece.querySelector('span');
    piece.innerHTML = `${runeShapeSvg(piece.dataset.piece, 'full')}${label ? label.outerHTML : ''}`;
    piece.classList.add('is-placed');
    altar.querySelector('[data-rune-set]').appendChild(piece);
    const need = root.querySelectorAll('.runePiece[data-fits="1"]').length;
    const placed = [...altar.querySelectorAll('.runePiece.is-placed')];
    if (placed.length < need) return;
    altar.classList.add('is-forged');
    const ids = placed.map((node) => node.dataset.piece);
    setTimeout(() => handleStationChallenge(root.dataset.station, { ids }), 780);
  };
  document.addEventListener('pointerup', finishRuneDrag);
  document.addEventListener('pointercancel', finishRuneDrag);

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'keepersForm') return;
    event.preventDefault();
    submitKeepers(event.target);
  });

  window.addEventListener('popstate', route);
  window.addEventListener('pagehide', stopStoryAudio);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (dom.beginStory && !dom.beginStory.hidden) { hideStoryModal(); return; }
    if (dom.beginBrief && !dom.beginBrief.hidden) { hideBeginBrief(); return; }
    if (Scanner.isOpen()) Scanner.close();
    else if (!dom.award.hidden) dismissAward();
    else if (!dom.finale.hidden) hideFinale();
    else if (mapModalMode === 'choice') return;
    else if (mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
    else if (currentPanel) closePanels();
    else if (dom.legend && !dom.legend.hidden) {
      dom.legend.hidden = true;
      dom.filterButton?.setAttribute('aria-expanded', 'false');
      dom.filterButton?.focus();
    }
    else if (document.body.classList.contains('guide-open')) closeGuide();
  });
}

async function boot() {
  wire();
  try {
    await Store.load();
  } catch {
    dom.splash.innerHTML = `<div class="empty"><h3 class="empty__title">Can’t reach Castle Quest</h3><p class="empty__body">Check your connection and reload.</p></div>`;
    return;
  }

  const park = Store.state.park || {};
  const adventure = Store.state.adventure || {};
  dom.parkName.textContent = 'Castle Quest';
  dom.parkLocation.textContent = park.locationName || park.name || '';
  document.title = `Castle Quest — ${park.name || 'Ice Castles'}`;
  if (adventure.venueCode && !Store.state.path.venueCode) {
    history.replaceState(null, '', `${Store.stationPath(Store.state.path.station)}${location.search}`);
    Store.state.path = Store.pathContext();
  }

  renderProgress();
  await route();

  if (Store.state.session?.winterKeeper && Store.state.path.station === 'heart') {
    showFinale();
  }

  dom.splash.classList.add('is-gone');
  setTimeout(() => { dom.splash.hidden = true; }, 520);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

boot();
