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

// Never cache the shells; the service worker handles offline copies instead.
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
 * Physical QR codes encode /s/CODE. That means a guest can scan with their
 * phone's built-in camera and still land in the app with the scan already
 * applied — no "please install our app" step, which is the whole point.
 */
app.get('/s/:code', (req, res) => {
  const code = String(req.params.code).replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  res.redirect(302, `/#/scan/${code}`);
});

app.use(express.static(PUBLIC_DIR, { maxAge: '1h', extensions: ['html'] }));

app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));

// Hash routing means everything else is the guest shell.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
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
