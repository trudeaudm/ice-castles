# Ice Castles — Guest Park Guide

A mobile-first web app for guests inside the park: a pannable park map with markers,
QR-code scanning for details and scavenger hunts, and progress that survives between
visits without anyone making an account. Plus an admin dashboard for placing markers
by dragging them around the map.

Built to be boring where it counts (plain Node, no build step, no framework) and
opinionated where it matters (the map, the scan moment, the passport).

---

## Run it locally

```bash
npm install
npm run seed     # 15 sample markers across the real NH zones + one working hunt
npm start
```

- Guest app → http://localhost:3000
- Admin dashboard → http://localhost:3000/admin (password: `letmein`, or whatever you set in `ADMIN_PASSWORD`)

No database to install. With no `DATABASE_URL` set it writes a SQLite file to `./data`.

`npm run seed` prints every scan code to the terminal. Tap the scan button in the app
and type one into the "Or type the code" box to test the game loop without printing signs.

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
  index.js        Express app, static hosting, /s/:code deep links
  db.js           One data layer, two engines (SQLite locally, Postgres on Render)
  schema.js       Tables + default settings, run on every boot
  seed.js         Sample park content
  routes/
    public.js     Guest API: bootstrap, anonymous identity, scanning
    admin.js      Admin API + QR generation + printable sign sheet
public/
  index.html      Guest app shell
  app.css         Design system and every component style
  js/
    api.js        Store, guest token, offline scan queue
    map.js        Leaflet wrapper + custom crystal markers
    scanner.js    Camera QR scanning, falls back to typing the code
    app.js        Routing, sheet, panels, the award sequence
  admin/          Dashboard (own HTML/CSS/JS)
  vendor/         Leaflet + jsQR, self-hosted so the park works offline
  assets/         Placeholder park map artwork
```

### The map, and why coordinates are pixels

The map is a single image rendered through Leaflet with `CRS.Simple`. Marker positions
are stored as **pixel coordinates on that image**, not lat/lng. A marker at `x=1420,
y=1060` sits on that pixel at every zoom level.

This matters for you specifically: when the real park artwork replaces
`public/assets/park-map.svg`, **keep the same width and height** and every marker you
placed stays exactly where you put it. Different dimensions? Update them in
Settings and re-drag. Nothing else changes.

### Anonymous guests

On first load the app asks the server for a guest token, stores it in `localStorage`, and
sends it on every request. Progress lives server-side against that token. No accounts, no
email, no personal data — a guest closes the tab, comes back next Friday, still has their
tokens. If they clear browser data or switch phones they start fresh, which is the right
trade for not asking families to make a login while standing in the cold.

### Scan codes stay on the server

The guest app is never told which code belongs to which marker. If it knew, a guest could
finish the whole hunt from the parking lot. The only way to earn a token is to physically
reach the sign.

### Two kinds of QR entry

Physical signs encode `https://your-url/s/ABC123`. That means:

- **Phone camera app** → lands on the app with the scan already applied. No install step.
- **In-app scanner** → faster for guests already playing, keeps them in the loop.

Both paths hit the same endpoint. Scans are idempotent, so a kid mashing one code can't
farm tokens and a flaky retry can't double-count.

### Offline

Cell service in a field in New Hampshire is not a given. A service worker caches the shell
and the map artwork, and scans taken while offline queue in `localStorage` and replay the
moment signal returns — the award animation fires then. Guests keep walking instead of
standing still holding their phone up.

---

## Using the dashboard

**Map tab** is the fast path. Click open ground to create a marker right there. Drag any
marker to move it; the position saves by itself. New markers start as **drafts** — invisible
to guests until you tick "Visible to guests", so you can stage a whole zone before it goes live.

**Markers tab** is the list view: every marker, its code, its scan count tonight.
"Roll code" issues a new code if a sign gets damaged or you're reprinting — the old
printout stops working immediately.

**Trails tab** builds the hunts. A trail is a set of markers; each one gives a token; the
reward unlocks when a guest has them all. Each stop has a token name, a glyph, and a hint —
the hint is what guests see *before* they find it, so that's where the puzzle lives. Trails
can be paused without deleting guest progress.

**Signs tab** generates the QR codes. "Open print sheet" gives you one sign per page,
each with the code printed underneath as a fallback for guests whose camera won't cooperate.

---

### The reference grid

The admin map has a **Grid on / Grid off** toggle in the header. It draws 100px cells
labelled `A`–`T` across and `1`–`14` down, so a position can be spoken out loud —
"the golem sits in E3" — while the real artwork is still being drawn from overhead
photographs.

The marker table shows each marker's grid cell above its raw pixel coordinates.

The grid is a separate Leaflet layer that only the admin page loads. The guest app never
requests `grid.js` at all, so there is nothing to remember to switch off before opening
night.

Cell size is configurable in **Settings → grid_cell** if 100px cells end up too coarse
or too fine for the final artwork.

### Swapping in the real map

The placeholder is a 2000×1400 SVG drawn in a storybook register: cream trails with inked
edges, hand-lettered italic zone labels, illustrated firs and huts, a compass rose. It is
meant to be replaced, not kept.

Marker positions are stored in *that image's* pixel space, so:

**Keep the same aspect ratio (10:7) and every existing marker stays exactly where it is.**

To swap artwork:

1. Export the new illustration (SVG preferred; PNG or WebP work) into `public/assets/`.
2. **Settings → map_image_url** → point at the new file.
3. If the pixel dimensions changed, update **map_width** and **map_height** to match.
   Different dimensions at the same ratio rescale cleanly; a different ratio will need
   markers nudged.

When the overhead photographs are ready, the intended path is: trace the real trail
geometry and structure footprints from the photo at 2000×1400, illustrate over that, and
export. The grid gives both sides a shared vocabulary for the hand-off — you can mark up
a photograph with the same cell references the dashboard uses.

---

## Design notes

Two accents carry the whole product: **cold teal** for the park and anything
informational, **warm amber** for anything a guest has earned. Nothing is amber until
it's been collected — which is what makes the passport feel like it fills up with light.

The scan button breaks the nav bar like a shutter release because scanning is the app's
primary verb. The one deliberately big moment is the earn animation: frost cracks outward,
the medallion ignites cold-to-warm, the copy rises in behind it. It's expensive on purpose
and it only happens five or six times a visit.

Reduced motion is respected throughout, focus states are visible, and on desktop the app
stays phone-shaped and centred rather than stretching a thumb-reach layout across a monitor.

---

## What's deliberately not built yet

You said the storyline and locations aren't settled, so these are stubs the schema
already supports:

- **Storyline copy** lives in trail `description` / `tagline` / reward fields. All editable, no code changes.
- **Multiple concurrent trails** work today — one scan can award tokens on several trails at once.
- **Photos per marker** take a URL. If you want uploads instead, that's a file-storage decision (Render disks or S3) worth making once.
- **Nicknames** — the `guests` table and `PATCH /api/guest` support them; nothing in the UI asks yet.
- **Ordered hunts** (must find stop 1 before stop 2) — `hunt_stops.position` is stored and ordered but not enforced.
- **Timed or seasonal trails** — add start/end columns to `hunts` and filter in `loadHunts()`.
