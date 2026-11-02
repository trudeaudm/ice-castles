/**
 * Castle Quest station catalog.
 * Inserts missing published stations on every boot so a park that already
 * has map markers (and therefore skips `npm run seed`) still has a quest.
 * Existing station copy is left alone, except when it still matches a previous
 * catalog version — that copy is replaced. Admin edits are not overwritten.
 * Poi links are filled only when empty.
 */
const db = require('./db');
const { uuid, now, slugify, shortCode } = require('./helpers');

/** Pin art a location can wear. `park` is the ordinary location pin. */
const POI_MARKERS = ['park', 'water', 'earth', 'fire', 'air', 'spirit'];

/**
 * Realm seals that belong on the Mystic Forest. Air and Spirit used to be
 * drawn on Bird Aviary and Polar Tundra because those were the linked stops.
 */
const FOREST_PINS = [
  {
    name: 'Mystic Forest — Air',
    marker: 'air',
    x: 470,
    y: 150,
    blurb: 'Wind through the silk, and paths that lift your gaze.',
    description:
      'The Air stretch of the forest is wings, flags, and open height. Summit keeps the Wind realm here.',
  },
  {
    name: 'Mystic Forest — Spirit',
    marker: 'spirit',
    x: 650,
    y: 155,
    blurb: 'Quiet light between the trees.',
    description:
      'The Spirit stretch of the forest is where the field of light comes up out of the dark. Aurora keeps this realm.',
  },
];

const MARKER_DEFAULTS = [
  { name: 'Mystic Forest — Water', marker: 'water' },
  { name: 'Mystic Forest — Earth', marker: 'earth' },
  { name: 'Mystic Forest — Fire', marker: 'fire' },
  { name: 'Mystic Forest — Air', marker: 'air' },
  { name: 'Mystic Forest — Spirit', marker: 'spirit' },
  { name: 'Bird Aviary', marker: 'park' },
  { name: 'Polar Tundra', marker: 'park' },
];

/** Old catalog links. Corrected once, so a later admin change stays put. */
const RETARGET = [
  { slug: 'summit', from: 'Bird Aviary', to: 'Mystic Forest — Air' },
  { slug: 'aurora', from: 'Polar Tundra', to: 'Mystic Forest — Spirit' },
];

const REALM_OPTIONS = [
  { id: 'water', label: 'Water', color: '#5df0cf' },
  { id: 'earth', label: 'Earth', color: '#c4a574' },
  { id: 'fire', label: 'Fire', color: '#ffb455' },
  { id: 'air', label: 'Air', color: '#bfeaff' },
  { id: 'spirit', label: 'Spirit', color: '#9b8cff' },
];

const CHALLENGES = {
  cascade: {
    type: 'image_select',
    config: {
      prompt: 'Cascade spotted tiny frozen wonders nearby. Look closely at the ice, then choose the three images that match what you see.',
      hint: 'Look for the clues on the monument around you.',
      selectCount: 3,
      correctIds: ['ice-vein', 'ice-arch', 'ice-ripple'],
      images: [
        { id: 'ice-vein', label: 'Hairline vein', color: '#8ec9e8', url: '/assets/art/cascade-ice-vein.png' },
        { id: 'lantern-glow', label: 'Lantern glow', color: '#ffb455', url: '/assets/art/cascade-lantern-glow.png' },
        { id: 'ice-arch', label: 'Pressed arch', color: '#c5e8f6', url: '/assets/art/cascade-ice-arch.png' },
        { id: 'silk-wing', label: 'Silk wing', color: '#ff8fb8', url: '/assets/art/cascade-silk-wing.png' },
        { id: 'ice-ripple', label: 'Frozen ripple', color: '#5df0cf', url: '/assets/art/cascade-ice-ripple.png' },
        { id: 'rune-cut', label: 'Carved rune', color: '#c4a574', url: '/assets/art/cascade-rune-cut.png' },
      ],
    },
  },
  granite: {
    type: 'code_entry',
    config: {
      prompt: 'Four of Granite’s moose are hiding nearby, each with a letter. Find them all and arrange the letters to reveal a shape you can find in a castle.',
      hint: 'Look for the clues on the monument around you.',
      fieldLabel: 'The word you found',
      placeholder: 'Enter the word',
      submitLabel: 'Awaken Earth',
      code: 'ARCH',
    },
  },
  ember: {
    type: 'sequence',
    config: {
      prompt: 'Tap the four lantern colors in the order you see them.',
      kind: 'color',
      length: 4,
      options: [
        { id: 'ice', label: 'Ice', color: '#8ec9e8' },
        { id: 'amber', label: 'Amber', color: '#ffb455' },
        { id: 'rose', label: 'Rose', color: '#ff8fb8' },
        { id: 'violet', label: 'Violet', color: '#9b8cff' },
      ],
      correct: ['amber', 'ice', 'rose', 'violet'],
    },
  },
  summit: {
    type: 'code_entry',
    config: { prompt: 'Five flags reveal a word. Enter it.', code: 'CARVE' },
  },
  aurora: {
    type: 'multi_sequence',
    config: {
      prompt: 'Watch the installation, then tap the five Realm symbols in the order you saw.',
      kind: 'symbol',
      length: 5,
      options: REALM_OPTIONS,
      accepted: [
        ['water', 'earth', 'fire', 'air', 'spirit'],
        ['earth', 'water', 'air', 'fire', 'spirit'],
        ['spirit', 'air', 'fire', 'earth', 'water'],
      ],
    },
  },
  builders: {
    type: 'quiz',
    config: {
      prompt: 'A short builder quiz. There is no passing score — finish it when you are ready.',
      questions: [
        {
          question: 'What is an Ice Castle grown from?',
          choices: ['Cut stone blocks', 'Water, cold, and time', 'Carved foam', 'Glass panels'],
        },
        {
          question: 'How do icicles become walls?',
          choices: ['They are printed overnight', 'Harvested, placed by hand, then sprayed until they fuse', 'Poured into molds', 'Shipped in from a factory'],
        },
        {
          question: 'Who began growing these castles?',
          choices: ['A lighting designer', 'Brent Christensen', 'A municipal ice crew', 'An unknown winter spirit'],
        },
        {
          question: 'Why does the forest lighting stay low in some rooms?',
          choices: ['To save power', 'So your eyes adjust and the sculptures appear', 'Because the LEDs failed', 'To hide unfinished work'],
        },
        {
          question: 'What should you do on uneven ice?',
          choices: ['Run the loops', 'Walk, and keep little ones in reach', 'Climb the walls', 'Sit until it melts'],
        },
      ],
    },
  },
};

/** Previous catalog copy. Boot replaces a station only while it still matches. */
const PREVIOUS_COPY = {
  cascade: {
    subtitle: 'Guardian of Water',
    body: 'Cascade watches the moving ice — currents frozen mid-pour, light shifting like a river under the surface.',
    discover_body: 'Water is the trickiest element to grow, because it has to look like it is still moving. Look for veins, ripples, and arches pressed into the ice around this shrine.',
    prompt: 'Three of these details are frozen in the ice beside you. Tap the three that match what you see.',
  },
  granite: {
    subtitle: 'Guardian of Earth',
    body: 'Granite keeps the roots and the weight of the forest. Stone-shouldered figures and carved runes mark this realm.',
    discover_body: 'Four physical moose are hidden nearby. Each one reveals a letter. Together they spell a builder’s word.',
    prompt: 'Four moose hide the letters. Enter the word they spell.',
  },
};

const QUEST_STATIONS = [
  {
    type: 'threshold',
    slug: 'threshold',
    title: 'The Threshold',
    subtitle: 'Where the Winter Keeper tradition begins',
    body:
      'Explore the castle. Discover the five Guardians — Water, Earth, Fire, Air, and Spirit — and complete their challenges in any order. When all five Realms are awake, scan The Heart to become a Winter Keeper.',
    discover_body: 'You may begin at any Castle Quest station. The Threshold is a welcome, not a gate you must find first.',
    sort_order: 0,
    poi: 'Entrance & Ticketing',
  },
  {
    type: 'guardian',
    slug: 'cascade',
    title: 'Cascade',
    subtitle: 'Water Realm · Penguin',
    element: 'water',
    body:
      'Cascade is a bright-eyed penguin who sees what hurried explorers miss: a bubble caught in clear ice, a ripple held still, a reflection that shimmers like a secret window.\n\nCascade remembers the first Winter Keeper asking how a single drop could become a castle. The answer came slowly: one icicle joined to another, shaped by cold and careful hands.\n\nIn the Water Realm, pause and look into the ice. The smallest detail may hold the biggest wonder.',
    discover_body:
      'Every Ice Castle begins and ends with Water. In the beginning, water changes its shape with temperature: it flows, freezes, and catches light. Ice Castles artisans grow and place icicles, fusing them into walls, arches, tunnels, and towers.\n\nLook closely and you may spot bubbles, layered textures, or blue light inside the ice. Each detail records a meeting of water, cold, time, and light. In the spring water changes its shape again, returning to the landscape around it.\n\nCascade invites you to notice how a single frozen detail belongs to a much larger, fleeting creation.',
    sort_order: 1,
    poi: 'Mystic Forest — Water',
    challenge: CHALLENGES.cascade,
  },
  {
    type: 'guardian',
    slug: 'granite',
    title: 'Granite',
    subtitle: 'Earth Realm · Moose',
    element: 'earth',
    body:
      'Granite is a big-hearted moose with the memory of an old trail and the patience of a builder. He knows the castle begins before the first icicle is placed: with a place to build, a plan for people to move through it, and close attention to the ground beneath everyone’s boots.\n\nGranite leaves clues for explorers who look steadily. In the Earth Realm, notice what supports the magic, not only what sparkles above it.',
    discover_body:
      'Every build begins with a site and a plan. Builders consider the ground, drainage, water and guest flow, access, safety, snow, and the way weather may change the work. Conditions keep shifting: ice can grow, surfaces can wear, and a warm spell can alter the schedule. The craft is to work with the site and the season. Granite stands for the planning and practical care that help a beautiful place welcome guests.',
    sort_order: 2,
    poi: 'Mystic Forest — Earth',
    challenge: CHALLENGES.granite,
  },
  {
    type: 'guardian',
    slug: 'ember',
    title: 'Ember',
    subtitle: 'Guardian of Fire',
    element: 'fire',
    body:
      'Ember is warm light through cold silk — flicker without flame. Stand still in the fire realm and the heat is almost believable.',
    discover_body:
      'Four colored lanterns hang in a fixed order this season. Watch them, then tap that sequence on your phone.',
    sort_order: 3,
    poi: 'Mystic Forest — Fire',
    challenge: CHALLENGES.ember,
  },
  {
    type: 'guardian',
    slug: 'summit',
    title: 'Summit',
    subtitle: 'Guardian of Air',
    element: 'air',
    body:
      'Summit lifts the gaze. Wings overhead, wind in the silk, paths that ask you to look up more than once.',
    discover_body:
      'Five physical flags in this area reveal the letters of a single word. Enter what they spell.',
    sort_order: 4,
    poi: 'Mystic Forest — Air',
    challenge: CHALLENGES.summit,
  },
  {
    type: 'guardian',
    slug: 'aurora',
    title: 'Aurora',
    subtitle: 'Guardian of Spirit',
    element: 'spirit',
    body:
      'Aurora holds the quiet between lights — the moment your eyes adjust and the field comes up out of the dark.',
    discover_body:
      'A physical installation plays several five-symbol Realm sequences on a loop. Repeat any one of them. The website answers on its own — no show-control hookup is required.',
    sort_order: 5,
    poi: 'Mystic Forest — Spirit',
    challenge: CHALLENGES.aurora,
  },
  {
    type: 'monument',
    slug: 'builders',
    title: 'Builder’s Monument',
    subtitle: 'The First Winter Keeper and the craft of ice',
    body:
      'Brent Christensen, First Winter Keeper, began growing castles from water, cold, and patience. This monument is optional — it does not affect becoming a Winter Keeper.',
    discover_body:
      'Icicles are harvested, placed by hand, and sprayed until they fuse. Lighting, carving, and overnight growth turn a field into a castle that can hold more than twenty million pounds of ice.',
    sort_order: 6,
    poi: 'The Ice Castle',
    challenge: CHALLENGES.builders,
  },
  {
    type: 'heart',
    slug: 'heart',
    title: 'Heart of Winter',
    subtitle: 'Recognition at the end of the path',
    body:
      'The five Realms must already be awake. Scanning The Heart is what finishes Castle Quest — completing the last Guardian is not enough.',
    discover_body:
      'If a Realm is still sleeping, this page will tell you which one. When all five are complete, the Winter Keeper finale opens here.',
    sort_order: 7,
    poi: 'Warming Hut',
  },
];

function forestSlots(byName) {
  const anchors = ['Mystic Forest — Earth', 'Mystic Forest — Water', 'Mystic Forest — Fire']
    .map((name) => byName.get(name))
    .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (anchors.length < 2) return null;
  const gaps = [];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const a = anchors[i];
    const b = anchors[i + 1];
    gaps.push({
      x: Math.round((a.x + b.x) / 2),
      y: Math.round((a.y + b.y) / 2),
    });
  }
  gaps.sort((a, b) => a.y - b.y);
  return {
    air: gaps[0],
    spirit: gaps.length > 1
      ? gaps[gaps.length - 1]
      : { x: gaps[0].x + 36, y: gaps[0].y + 72 },
    anchors,
  };
}

/** Use the catalog spot only when it already sits with the other forest pins. */
function placeForestPin(pin, slots) {
  if (!slots) return { x: pin.x, y: pin.y };
  const spot = slots[pin.marker];
  if (!spot) return { x: pin.x, y: pin.y };
  const nearest = Math.min(...slots.anchors.map((p) => Math.hypot(pin.x - p.x, pin.y - p.y)));
  return nearest > 280 ? spot : { x: pin.x, y: pin.y };
}

async function uniqueScanCode() {
  for (let i = 0; i < 50; i++) {
    const code = shortCode(6);
    const clash = await db.get('SELECT id FROM pois WHERE scan_code = ?', [code]);
    if (!clash) return code;
  }
  return shortCode(10);
}

/**
 * Put the Wind and Spirit seals on the Mystic Forest, and give Bird Aviary
 * and Polar Tundra the ordinary park pin. Runs for parks that already have
 * that layout. A marker an admin has already chosen is left alone.
 */
async function ensureMapMarkers(adventureId) {
  const pois = await db.all(
    'SELECT id, name, marker, sort_order, x, y FROM pois WHERE adventure_id = ?',
    [adventureId]
  );
  const byName = new Map(pois.map((p) => [p.name, p]));
  const nhLayout = pois.some((p) =>
    p.name.startsWith('Mystic Forest') || p.name === 'Bird Aviary' || p.name === 'Polar Tundra'
  );
  if (!nhLayout) return byName;

  const ts = now();
  const flagKey = `quest_pin_retarget:${adventureId}`;
  const already = await db.get('SELECT value FROM settings WHERE "key" = ?', [flagKey]);

  const slots = forestSlots(byName);

  if (!already) {
    let sort = pois.reduce((max, p) => Math.max(max, Number(p.sort_order) || 0), 0);
    for (const pin of FOREST_PINS) {
      if (byName.has(pin.name)) continue;
      sort += 1;
      const id = uuid();
      const at = placeForestPin(pin, slots);
      await db.run(
        `INSERT INTO pois
           (id, adventure_id, name, slug, category, zone, blurb, description, fun_fact, image_url,
            x, y, scan_code, published, sort_order, marker, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, adventureId, pin.name, slugify(pin.name), 'sculpture', 'Mystic Forest',
          pin.blurb, pin.description, null, null,
          at.x, at.y, await uniqueScanCode(), 1, sort, pin.marker, ts, ts,
        ]
      );
      byName.set(pin.name, { id, name: pin.name, marker: pin.marker, sort_order: sort, x: at.x, y: at.y });
    }

    for (const move of RETARGET) {
      const from = byName.get(move.from);
      const to = byName.get(move.to);
      if (!from || !to) continue;
      await db.run(
        `UPDATE touchpoints SET poi_id = ?, updated_at = ?
          WHERE adventure_id = ? AND slug = ? AND poi_id = ?`,
        [to.id, ts, adventureId, move.slug, from.id]
      );
    }

    await db.run(
      'INSERT INTO settings ("key", "value") VALUES (?, ?) ON CONFLICT ("key") DO NOTHING',
      [flagKey, '1']
    );
  }

  for (const pin of FOREST_PINS) {
    const row = byName.get(pin.name);
    if (!row) continue;
    const stillAtCatalog = Math.round(Number(row.x)) === pin.x && Math.round(Number(row.y)) === pin.y;
    if (!stillAtCatalog) continue;
    const at = placeForestPin(pin, slots);
    if (at.x === pin.x && at.y === pin.y) continue;
    await db.run(
      'UPDATE pois SET x = ?, y = ?, updated_at = ? WHERE id = ? AND x = ? AND y = ?',
      [at.x, at.y, ts, row.id, pin.x, pin.y]
    );
    row.x = at.x;
    row.y = at.y;
  }

  for (const pin of MARKER_DEFAULTS) {
    const row = byName.get(pin.name);
    if (!row || row.marker) continue;
    await db.run(
      `UPDATE pois SET marker = ?, updated_at = ? WHERE id = ? AND (marker IS NULL OR marker = '')`,
      [pin.marker, ts, row.id]
    );
    row.marker = pin.marker;
  }

  return byName;
}

async function ensureQuestStations(adventureId) {
  if (!adventureId) return 0;
  const byName = await ensureMapMarkers(adventureId);
  const idByName = Object.fromEntries([...byName.entries()].map(([name, p]) => [name, p.id]));
  const ts = now();
  let added = 0;

  for (const tp of QUEST_STATIONS) {
    const row = await db.get(
      'SELECT id, poi_id, subtitle, body, discover_body, config FROM touchpoints WHERE adventure_id = ? AND slug = ?',
      [adventureId, tp.slug]
    );
    const poiId = idByName[tp.poi] || null;
    if (!row) {
      await db.run(
        `INSERT INTO touchpoints
           (id, adventure_id, type, slug, title, subtitle, body, discover_body, element, image_url, audio_url,
            poi_id, sort_order, published, challenge_type, config, slug_locked, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuid(), adventureId, tp.type, tp.slug, tp.title, tp.subtitle, tp.body,
          tp.discover_body || null, tp.element || null, null, null, poiId,
          tp.sort_order, 1, tp.challenge?.type || null,
          tp.challenge ? JSON.stringify(tp.challenge.config) : null, 1, ts, ts,
        ]
      );
      added += 1;
      continue;
    }
    if (!row.poi_id && poiId) {
      await db.run(
        'UPDATE touchpoints SET poi_id = ?, updated_at = ? WHERE id = ?',
        [poiId, ts, row.id]
      );
    }
    const previous = PREVIOUS_COPY[tp.slug];
    if (previous) {
      const copySame = row.subtitle === previous.subtitle
        && row.body === previous.body
        && row.discover_body === previous.discover_body;
      if (copySame) {
        await db.run(
          'UPDATE touchpoints SET subtitle = ?, body = ?, discover_body = ?, updated_at = ? WHERE id = ?',
          [tp.subtitle, tp.body, tp.discover_body || null, ts, row.id]
        );
      }
      if (previous.prompt && tp.challenge && row.config) {
        let cfg = null;
        try { cfg = JSON.parse(row.config); } catch { cfg = null; }
        if (cfg && cfg.prompt === previous.prompt) {
          cfg.prompt = tp.challenge.config.prompt;
          for (const key of ['hint', 'fieldLabel', 'placeholder', 'submitLabel']) {
            if (tp.challenge.config[key]) cfg[key] = tp.challenge.config[key];
          }
          await db.run(
            'UPDATE touchpoints SET config = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(cfg), ts, row.id]
          );
        }
      }
    }
  }

  if (added) {
    console.log(`Castle Quest: added ${added} station${added === 1 ? '' : 's'} to adventure ${adventureId}`);
  }
  return added;
}

async function ensureQuestStationsAll() {
  const adventures = await db.all('SELECT id FROM adventures');
  let total = 0;
  for (const row of adventures) {
    total += await ensureQuestStations(row.id);
  }
  return total;
}

module.exports = {
  CHALLENGES,
  QUEST_STATIONS,
  POI_MARKERS,
  ensureQuestStations,
  ensureQuestStationsAll,
};
