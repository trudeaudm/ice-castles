/**
 * Seeds a realistic starter park so the app is explorable the moment it boots.
 * Safe to run repeatedly: it skips seeding if any POIs already exist.
 *   npm run seed          # only if empty
 *   npm run reset         # wipe content and reseed
 */
const db = require('./db');
const { migrate } = require('./schema');
const { uuid, shortCode, slugify, now } = require('./helpers');
const { createLocation, createAdventure, setActiveAdventure } = require('./adventures');

const POIS = [
  {
    name: 'The Ice Castle',
    category: 'landmark',
    zone: 'Ice Castle',
    x: 620, y: 700,
    blurb: 'Hand-placed icicles, grown all winter long.',
    description:
      'Everything you see here was grown, not built. Our ice artists harvest icicles by hand each night, place them by hand, then spray them with water until they fuse. A finished castle can hold more than twenty million pounds of ice.',
    fun_fact: 'A single archway can take two people most of a night to grow.',
  },
  {
    name: 'Fairy Village',
    category: 'photo-op',
    zone: 'Fairy Village',
    x: 300, y: 960,
    blurb: 'Small doors, smaller residents, best photo in the park.',
    description:
      'Look low. The village is built at kid height on purpose, with lit doorways tucked into the drifts. Crouch down to line up a shot through one of the arches.',
    fun_fact: 'Every door is a different colour of silk, lit from behind.',
  },
  {
    name: 'Mystic Forest — Earth',
    category: 'sculpture',
    zone: 'Mystic Forest',
    x: 430, y: 300,
    blurb: 'Where the Female Golem keeps watch over the roots.',
    description:
      'The Earth section holds the heaviest work in the forest: stone-shouldered figures, carved runes, and the Female Golem standing in the treeline. Look for the runes cut into the low walls.',
    fun_fact: 'The runes are carved rather than printed, so they read differently as you move.',
  },
  {
    name: 'Mystic Forest — Water',
    category: 'sculpture',
    zone: 'Mystic Forest',
    x: 560, y: 220,
    blurb: 'Frozen mid-pour.',
    description:
      'Water is the trickiest element to carve, because it has to look like it is still moving. Watch the lighting cycle — the colour shift is programmed to feel like a current.',
  },
  {
    name: 'Mystic Forest — Fire',
    category: 'sculpture',
    zone: 'Mystic Forest',
    x: 700, y: 260,
    blurb: 'Warm light through cold silk.',
    description:
      'Amber silk lanterns and pixel-mapped LEDs give this section its flicker. Nothing here is actually burning, but stand still for a moment and it reads like heat.',
  },
  {
    name: 'Bird Aviary',
    category: 'lantern',
    zone: 'Bird Aviary',
    x: 1010, y: 455,
    blurb: 'A flock of illuminated silk wings overhead.',
    description:
      'Wireframe bodies wrapped in painted silk, lit from the inside and hung at different heights so the flock moves with the wind. Walk the whole loop and look up more than once.',
    fun_fact: 'Each bird is painted by hand, so no two in the flock match.',
  },
  {
    name: 'Yeti Bend',
    category: 'sculpture',
    zone: 'Yeti Bend',
    x: 1250, y: 305,
    blurb: 'Something large came through here.',
    description:
      'The bend is the coldest, quietest stretch of the horse path. Follow the tracks in the snow and see where they lead before you round the corner.',
  },
  {
    name: 'Polar Tundra',
    category: 'sculpture',
    zone: 'Polar Tundra',
    x: 1560, y: 390,
    blurb: 'Bears, ice floes, and very little light.',
    description:
      'We keep the lighting low here on purpose so your eyes adjust. Give it thirty seconds and the whole field of sculptures comes up out of the dark.',
  },
  {
    name: 'Dragon Roost',
    category: 'lantern',
    zone: 'Dragon Roost',
    x: 1780, y: 620,
    blurb: 'Three dragons, and a great many fire lizards.',
    description:
      'Three large dragon silk lanterns roost above the path, with a scatter of 3D-printed fire lizards hidden in the rocks below and paper lanterns strung through the trees. Count the lizards if you can.',
    fun_fact: 'The lizards are printed in-house and no two are placed the same way twice.',
  },
  {
    name: 'Deer Sanctuary',
    category: 'lantern',
    zone: 'Deer Sanctuary',
    x: 1690, y: 900,
    blurb: 'A still herd, glowing between the trees.',
    description:
      'Illuminated animal lanterns set back off the path so they read as a real herd at a distance. Stay on the trail and let your eyes find them.',
  },
  {
    name: 'Butterfly Garden',
    category: 'lantern',
    zone: 'Butterfly Garden',
    x: 1420, y: 1060,
    blurb: 'Hundreds of wings, all lit from within.',
    description:
      'The garden is the brightest, warmest stop on the horse path — a canopy of silk butterflies on wireframe, colour-cycled slowly so the whole garden breathes.',
  },
  {
    name: 'Horse Station',
    category: 'ride',
    zone: 'Horse Station',
    x: 1150, y: 1180,
    blurb: 'Where the horse-drawn rides load.',
    description:
      'Rides run on a loop through the horse path when conditions allow. Check the board at the station for tonight’s schedule and wait times.',
  },
  {
    name: 'Tubing Hill',
    category: 'ride',
    zone: 'Tubing Hill',
    x: 860, y: 1160,
    blurb: 'Downhill, fast, then walk back up.',
    description:
      'Grab a tube at the bottom, climb the stairs on the left, and ride the lit lanes down. Riders must be able to hold themselves upright on the tube.',
  },
  {
    name: 'Warming Hut',
    category: 'amenity',
    zone: 'Warming Hut',
    x: 400, y: 1160,
    blurb: 'Hot chocolate, fire pits, and the reward counter.',
    description:
      'Warm up here. This is also where you redeem anything you unlock in the app — show your screen at the counter.',
  },
  {
    name: 'Entrance & Ticketing',
    category: 'amenity',
    zone: 'Entrance',
    x: 212, y: 1250,
    blurb: 'Start here. Restrooms on the right.',
    description:
      'Tickets are scanned at the gate. Restrooms, stroller parking, and the lost-and-found are all in this building.',
  },
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

async function ensureNhAdventure() {
  let location = await db.get('SELECT * FROM locations WHERE slug = ?', ['NHAdventure']);
  if (!location) {
    location = await createLocation({
      name: 'Ice Castles',
      slug: 'NHAdventure',
      venue_code: 'nh',
      region: 'North Woodstock, New Hampshire',
    });
  }

  const year = new Date().getFullYear();
  let adventure = await db.get(
    'SELECT * FROM adventures WHERE location_id = ? AND year = ?',
    [location.id, year]
  );
  if (!adventure) {
    adventure = await createAdventure(location.id, {
      name: `${year} NH Adventure`,
      year,
      is_active: true,
      welcome_headline: 'Find your way through the ice',
      welcome_body:
        'Tap any marker to learn what you are looking at. Follow a trail to collect light and unlock the reward at the Warming Hut.',
      hours_note: 'Open nightly, weather permitting. Check the front gate for tonight’s closing time.',
      safety_note: 'Ice is uneven and slippery. Walk, don’t run, and keep little ones in reach.',
      map_image_url: '/assets/park-map.webp',
      map_width: 2000,
      map_height: 1400,
      grid_cell: 100,
    });
  } else {
    await setActiveAdventure(adventure.id);
    adventure = await db.get('SELECT * FROM adventures WHERE id = ?', [adventure.id]);
  }
  return adventure;
}

async function seed() {
  await migrate();

  const force = process.argv.includes('--force');
  const existing = await db.get('SELECT COUNT(*) AS n FROM pois');

  if (Number(existing.n) > 0 && !force) {
    console.log(`Park already has ${existing.n} markers — nothing to do. Use "npm run reset" to wipe and reseed.`);
    return;
  }

  if (force) {
    for (const table of [
      'quest_events', 'session_realms', 'quest_sessions',
      'hunt_completions', 'guest_tokens', 'guest_scans', 'hunt_stops', 'hunts', 'touchpoints', 'pois',
    ]) {
      await db.run(`DELETE FROM ${table}`);
    }
    console.log('Cleared existing content.');
  }

  const adventure = await ensureNhAdventure();
  await db.run(
    `UPDATE adventures SET badge_title=?, badge_body=?, badge_redemption=?,
       welcome_headline=?, welcome_body=?, updated_at=? WHERE id=?`,
    [
      'Winter Keeper',
      'You walked the Threshold, met the Guardians, and carried light to the Heart of Winter.',
      'Show this badge at the Warming Hut to claim your Winter Keeper pin.',
      'Welcome, Winter Keeper',
      'Explore the castle. Discover the five Guardians, complete their challenges in any order, then scan The Heart to become a Winter Keeper.',
      now(),
      adventure.id,
    ]
  );
  const ts = now();
  const idByName = {};

  for (const [i, p] of POIS.entries()) {
    const id = uuid();
    idByName[p.name] = id;
    await db.run(
      `INSERT INTO pois (id, adventure_id, name, slug, category, zone, blurb, description, fun_fact,
         image_url, x, y, scan_code, published, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, adventure.id, p.name, slugify(p.name), p.category, p.zone, p.blurb, p.description,
        p.fun_fact || null, null, p.x, p.y, shortCode(6), 1, i, ts, ts,
      ]
    );
  }

  const TOUCHPOINTS = [
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

  for (const tp of TOUCHPOINTS) {
    await db.run(
      `INSERT INTO touchpoints
         (id, adventure_id, type, slug, title, subtitle, body, discover_body, element, image_url, audio_url,
          poi_id, sort_order, published, challenge_type, config, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uuid(), adventure.id, tp.type, tp.slug, tp.title, tp.subtitle, tp.body,
        tp.discover_body || null, tp.element || null, null, null, idByName[tp.poi] || null,
        tp.sort_order, 1, tp.challenge?.type || null,
        tp.challenge ? JSON.stringify(tp.challenge.config) : null, ts, ts,
      ]
    );
  }

  const codes = await db.all(
    'SELECT name, scan_code FROM pois WHERE adventure_id = ? ORDER BY sort_order',
    [adventure.id]
  );
  console.log(`\nSeeded ${POIS.length} markers and ${TOUCHPOINTS.length} Castle Quest stations under /nh.\n`);
  console.log('Guest app: http://localhost:3000/nh');
  console.log('Station URLs:');
  for (const tp of TOUCHPOINTS) console.log(`  http://localhost:3000/nh/${tp.slug}`);
  console.log('\nAmenity map codes (site guide only):');
  for (const c of codes) console.log(`  ${c.scan_code}   ${c.name}`);
  console.log('');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
