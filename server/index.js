const path = require('path');
const express = require('express');
const { migrate } = require('./schema');
const publicRoutes = require('./routes/public');
const { router: adminRoutes } = require('./routes/admin');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

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
 * Physical QR codes encode /s/CODE or /{locationSlug}/s/CODE.
 * Resolve the POI → adventure path so the guest lands in the right package.
 */
async function redirectScan(req, res, preferredSlug) {
  const code = String(req.params.code).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  const poi = await db.get(
    `SELECT p.scan_code, l.slug AS location_slug
       FROM pois p
       LEFT JOIN adventures a ON a.id = p.adventure_id
       LEFT JOIN locations l ON l.id = a.location_id
      WHERE p.scan_code = ?`,
    [code]
  );
  const slug = preferredSlug || poi?.location_slug;
  const base = slug ? `/${slug}` : '';
  res.redirect(302, `${base}/#/scan/${code}`);
}

app.get('/s/:code', (req, res) => redirectScan(req, res, null));
app.get('/:locationSlug/s/:code', (req, res) => redirectScan(req, res, req.params.locationSlug));

app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.get('/admin/*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));

// Adventure paths and the root all serve the guest shell.
app.get(['/', '/:locationSlug', '/:locationSlug/:year'], (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/admin')) return next();
  // Don't hijack static assets that somehow missed express.static.
  if (/\.[a-z0-9]+$/i.test(req.path)) return next();
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
