# Ice Castles — Guest Park Guide

A mobile-first web app for guests inside the park: a pannable park map with markers,
QR-code scanning and other trail activations, and progress that survives between
visits without anyone making an account. Content is organized as **Location → yearly
Adventure**, with one active adventure per site (e.g. `/NHAdventure`).

Built to be boring where it counts (plain Node, no build step, no framework) and
opinionated where it matters (the map, the scan moment, the passport).

---

## Run it locally

```bash
npm install
npm run seed     # NH adventure + 15 sample markers + one working hunt
npm start
```

- Guest app → http://localhost:3000/NHAdventure
- Admin dashboard → http://localhost:3000/admin (password: `letmein`, or whatever you set in `ADMIN_PASSWORD`)

No database to install. With no `DATABASE_URL` set it writes a SQLite file to `./data`.

`npm run seed` prints every scan code to the terminal. Tap the scan button in the app
and type one into the "Or type the code" box to test the game loop without printing signs.
One sample stop uses a **multiple-choice** activation instead of a QR scan.

---

## Deploy to Render

1. Push this repo to GitHub.
2. In Render: **New +** → **Blueprint** → pick the repo. `render.yaml` creates the web
   service and a Postgres database, and wires `DATABASE_URL` between them.
3. Set two environment variables on the service:
   - `ADMIN_PASSWORD` — Render generates one; find it under the service's Environment tab and change it if you like.
   - `PUBLIC_BASE_URL` — your final URL, e.g. `https://icecastles.onrender.com`. This is the origin baked into printed QR codes, so set it *before* you print anything.
4. First deploy runs the migration automatically. To load the sample park, open the
   service's Shell and run `npm run seed`.

Tables are created on every boot if missing, so schema changes ship with a normal deploy.

**A note on plans:** the free web service sleeps after inactivity, so the first guest of
the night waits ~30 seconds for a cold start. For a live park that's worth the $7/month
starter plan. The free Postgres tier expires after 90 days — fine for testing a season,
not for a second one.

---

## How the pieces fit

```
server/
  index.js        Express app, static hosting, /s/:code and /:location/s/:code
  adventures.js   Location → Adventure helpers + challenge awarding
  db.js           One data layer, two engines (SQLite locally, Postgres on Render)
  schema.js       Tables + migration into the adventure tree
  seed.js         Sample NH adventure content
  routes/
    public.js     Guest API: bootstrap by location/year, scan, challenge
    admin.js      Admin API + QR generation + printable sign sheet
public/
  index.html      Guest app shell
  app.css         Design system and every component style
  js/
    api.js        Store, guest token, adventure path, offline scan queue
    map.js        Leaflet wrapper + journey-mode filtering
    scanner.js    Camera QR scanning, falls back to typing the code
    app.js        Routing, sheet, panels, challenges, the award sequence
  admin/          Dashboard (own HTML/CSS/JS)
  vendor/         Leaflet + jsQR, self-hosted so the park works offline
  assets/         Placeholder park map artwork
```

### Location → Adventure

Each **location** (e.g. NH, Montreal) has yearly **adventures**. One adventure per
location is **active**. Public short URLs resolve to the active package:

- `/NHAdventure` → active NH adventure
- `/NHAdventure/2026` → that specific year (kept around as an archive)

Admin can create a new year, build its map/content, then **Set active** when the
season opens. Old adventures stay in the CMS and stay inert.

### The map, and why coordinates are pixels

The map is a single image rendered through Leaflet with `CRS.Simple`. Marker positions
are stored as **pixel coordinates on that image**, not lat/lng. A marker at `x=1420,
y=1060` sits on that pixel at every zoom level.

When the real park artwork replaces `public/assets/park-map.svg`, **keep the same
width and height** and every marker stays where you put it. Different dimensions?
Update them in Settings and re-drag.

Guests can toggle **trail mode** on the map to hide amenity pins and focus only on
stops that belong to an active hunt.

### Anonymous guests

On first load the app asks the server for a guest token, stores it in `localStorage`, and
sends it on every request. Progress lives server-side against that token, scoped to the
adventure they opened. No accounts, no email, no personal data.

### Activations (how a stop completes)

Trail stops are no longer scan-only. Each stop has a `challenge_type`:

- `scan` — physical QR / typed code (default)
- `acknowledge` — tap to confirm
- `code_entry` — enter a code from the stop
- `multiple_choice` — pick the right answer
- `reflection` — leave a short note

QR scan codes are never sent to the client for scan-type stops. Non-scan challenges
are completed through `POST /api/challenge`.

### Two kinds of QR entry

Physical signs encode `https://your-url/NHAdventure/s/ABC123` (or `/s/ABC123`, which
redirects into the right adventure). That means:

- **Phone camera app** → lands on the app with the scan already applied. No install step.
- **In-app scanner** → faster for guests already playing, keeps them in the loop.

Both paths hit the same endpoint. Scans are idempotent.

### Offline

Cell service in a field in New Hampshire is not a given. A service worker caches the shell
and the map artwork, and scans taken while offline queue in `localStorage` and replay the
moment signal returns.

---

## Using the dashboard

Use the **Location / Adventure** selectors in the header. Everything you edit (map,
markers, trails, settings, signs) belongs to the selected adventure.

**Map tab** is the fast path. Click open ground to create a marker. Drag to move.
New markers start as **drafts**.

**Trails tab** builds hunts. Each stop has a token, hint, and activation type.
Trails can be paused without deleting guest progress.

**Signs tab** generates QR codes scoped to the adventure's location slug.

**Set active** makes the selected adventure the one `/NHAdventure` (etc.) serves.
**New year** creates a fresh empty adventure under the current location.

---

## What's deliberately not built yet

- **WKI storyline screens** (Threshold, Guardians, Builder's Monument, Heart of Winter badge) — content model + activations are ready to host them
- **Role-based admin users** — shared password is enough for a two-person ops team
- **File uploads** for marker photos — still URL fields
- **Nicknames** — API exists; nothing in the UI asks yet
- **Ordered hunts** — position stored, not enforced
- **Adventure duplication** — create a new year, then copy content by hand for now
