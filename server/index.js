const path = require('path');
const express = require('express');
const { migrate } = require('./schema');
const publicRoutes = require('./routes/public');
const { router: adminRoutes } = require('./routes/admin');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const RESERVED = new Set(['api', 'admin', 'assets', 'vendor', 'js', 's', 'healthz']);

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path === '/sw.js') {
    res.set('Cache-Control', 'no-cache');
  }
  next();
});

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/healthz', async (_req, res) => {
  try {
    await db.get('SELECT 1 AS ok');
    res.json({ ok: true, engine: db.usingPostgres ? 'postgres' : 'sqlite' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err.message || err) });
  }
});

/**
 * Physical amenity codes still use /s/CODE.
 * If that marker is a Castle Quest station, send the guest to the permanent URL.
 */
async function redirectScan(req, res, preferredSlug) {
  const code = String(req.params.code).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  const poi = await db.get(
    `SELECT p.id, p.scan_code, l.slug AS location_slug, l.venue_code
       FROM pois p
       LEFT JOIN adventures a ON a.id = p.adventure_id
       LEFT JOIN locations l ON l.id = a.location_id
      WHERE p.scan_code = ?`,
    [code]
  );
  if (poi) {
    const station = await db.get(
      `SELECT t.slug, l.venue_code
         FROM touchpoints t
         JOIN adventures a ON a.id = t.adventure_id
         JOIN locations l ON l.id = a.location_id
        WHERE t.poi_id = ? AND t.published = 1
        ORDER BY t.sort_order LIMIT 1`,
      [poi.id]
    );
    if (station) {
      const venue = station.venue_code || poi.venue_code || 'nh';
      return res.redirect(302, `/${venue}/${station.slug}`);
    }
  }
  const slug = preferredSlug || poi?.location_slug || poi?.venue_code;
  const base = slug ? `/${slug}` : '';
  res.redirect(302, `${base}/#/scan/${code}`);
}

app.get('/s/:code', (req, res) => redirectScan(req, res, null));
app.get('/:locationSlug/s/:code', (req, res) => {
  if (RESERVED.has(String(req.params.locationSlug).toLowerCase())) return res.status(404).end();
  return redirectScan(req, res, req.params.locationSlug);
});

app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.get('/admin/*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));

app.get(['/', '/:venue', '/:venue/:station'], async (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) return next();
  if (/\.[a-z0-9]+$/i.test(req.path)) return next();

  const venue = req.params.venue;
  if (venue && RESERVED.has(venue.toLowerCase())) return next();

  if (venue) {
    const location = await db.get(
      'SELECT slug, venue_code FROM locations WHERE venue_code = ? OR slug = ?',
      [venue.toLowerCase(), venue]
    );
    if (location?.venue_code && venue !== location.venue_code) {
      const rest = req.params.station ? `/${req.params.station}` : '';
      return res.redirect(302, `/${location.venue_code}${rest}`);
    }
  }

  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'server_error' });
});

migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Ice Castles guest app on http://localhost:${PORT}  (db: ${
          db.usingPostgres ? 'postgres' : 'sqlite'
        })`
      );
      console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
