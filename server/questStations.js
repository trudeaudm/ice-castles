/**
 * Castle Quest station catalog.
 * Inserts missing published stations on every boot so a park that already
 * has map markers (and therefore skips `npm run seed`) still has a quest.
 * Existing station copy is left alone; poi links are filled only when empty.
 */
const db = require('./db');
const { uuid, now } = require('./helpers');

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
      prompt: 'Three of these details are frozen in the ice beside you. Tap the three that match what you see.',
      selectCount: 3,
      correctIds: ['ice-vein', 'ice-arch', 'ice-ripple'],
      images: [
        { id: 'ice-vein', label: 'Hairline vein', color: '#8ec9e8' },
        { id: 'lantern-glow', label: 'Lantern glow', color: '#ffb455' },
        { id: 'ice-arch', label: 'Pressed arch', color: '#c5e8f6' },
        { id: 'silk-wing', label: 'Silk wing', color: '#ff8fb8' },
        { id: 'ice-ripple', label: 'Frozen ripple', color: '#5df0cf' },
        { id: 'rune-cut', label: 'Carved rune', color: '#c4a574' },
      ],
    },
  },
  granite: {
    type: 'code_entry',
    config: { prompt: 'Four moose hide the letters. Enter the word they spell.', code: 'ARCH' },
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
    subtitle: 'Guardian of Water',
    element: 'water',
    body:
      'Cascade watches the moving ice — currents frozen mid-pour, light shifting like a river under the surface.',
    discover_body:
      'Water is the trickiest element to grow, because it has to look like it is still moving. Look for veins, ripples, and arches pressed into the ice around this shrine.',
    sort_order: 1,
    poi: 'Mystic Forest — Water',
    challenge: CHALLENGES.cascade,
  },
  {
    type: 'guardian',
    slug: 'granite',
    title: 'Granite',
    subtitle: 'Guardian of Earth',
    element: 'earth',
    body:
      'Granite keeps the roots and the weight of the forest. Stone-shouldered figures and carved runes mark this realm.',
    discover_body:
      'Four physical moose are hidden nearby. Each one reveals a letter. Together they spell a builder’s word.',
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
    poi: 'Bird Aviary',
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
    poi: 'Polar Tundra',
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

async function ensureQuestStations(adventureId) {
  if (!adventureId) return 0;
  const pois = await db.all(
    'SELECT id, name FROM pois WHERE adventure_id = ?',
    [adventureId]
  );
  const idByName = Object.fromEntries(pois.map((p) => [p.name, p.id]));
  const ts = now();
  let added = 0;

  for (const tp of QUEST_STATIONS) {
    const row = await db.get(
      'SELECT id, poi_id FROM touchpoints WHERE adventure_id = ? AND slug = ?',
      [adventureId, tp.slug]
    );
    const poiId = idByName[tp.poi] || null;
    if (!row) {
      await db.run(
        `INSERT INTO touchpoints
           (id, adventure_id, type, slug, title, subtitle, body, discover_body, element, image_url, audio_url,
            poi_id, sort_order, published, challenge_type, config, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuid(), adventureId, tp.type, tp.slug, tp.title, tp.subtitle, tp.body,
          tp.discover_body || null, tp.element || null, null, null, poiId,
          tp.sort_order, 1, tp.challenge?.type || null,
          tp.challenge ? JSON.stringify(tp.challenge.config) : null, ts, ts,
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
  ensureQuestStations,
  ensureQuestStationsAll,
};
