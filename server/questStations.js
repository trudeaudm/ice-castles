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
const { SPIRIT_STATION_CONFIG, assertSpiritStationConfig } = require('./spiritStationConfig');

assertSpiritStationConfig();

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
      retry: 'Not quite. Take another look. Cascade knows the smallest details can hold the biggest wonder.',
      success: 'Water awakens. You found the wonder hidden in the ice, and Cascade’s mark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.',
      hint: 'Look for the clues on the monument around you.',
      selectCount: 3,
      correctIds: ['ice-vein', 'ice-arch', 'ice-ripple'],
      images: [
        { id: 'ice-vein', label: 'Hairline vein', color: '#8ec9e8', url: '/assets/art/cascade-ice-vein.svg' },
        { id: 'lantern-glow', label: 'Lantern glow', color: '#ffb455', url: '/assets/art/cascade-lantern-glow.svg' },
        { id: 'ice-arch', label: 'Pressed arch', color: '#c5e8f6', url: '/assets/art/cascade-ice-arch.svg' },
        { id: 'silk-wing', label: 'Silk wing', color: '#ff8fb8', url: '/assets/art/cascade-silk-wing.svg' },
        { id: 'ice-ripple', label: 'Frozen ripple', color: '#5df0cf', url: '/assets/art/cascade-ice-ripple.svg' },
        { id: 'rune-cut', label: 'Carved rune', color: '#c4a574', url: '/assets/art/cascade-rune-cut.svg' },
      ],
    },
  },
  granite: {
    type: 'code_entry',
    config: {
      prompt: 'Four of Granite’s moose are hiding nearby, each with a letter. Find them all and arrange the letters to reveal a shape you can find in a castle.',
      retry: 'Those letters are not in the right order yet. Check each moose again, then try once more.',
      success: 'Earth awakens. You found the word beneath the wonder, and Granite’s mark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.',
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
      prompt: 'Watch Ember’s four lanterns glow in sequence. Then tap their colors on your screen in the same order.',
      retry: 'The colors slipped out of order. Watch Ember’s lanterns again, then follow their glow.',
      success: 'Fire awakens. You followed the lantern light, and Ember’s spark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.',
      hint: 'Look for the clues on the monument around you.',
      clearLabel: 'Clear sequence',
      submitLabel: 'Awaken Fire',
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
    type: 'shape_match',
    config: {
      prompt: 'Summit scattered an air rune into five pieces. Drag every piece onto the altar until the triple spiral is whole again.',
      retry: 'These shapes have not found each other yet. Look for the pieces that belong together, then try once more.',
      success: 'Air awakens. You joined the shapes into the rune, and Summit’s mark joins your quest. When all five elements are awake, the Winter Keeper Throne will confirm your completion.',
      correctIds: ['vortex', 'draft', 'gale', 'zephyr', 'squall'],
      pieces: [
        { id: 'vortex', label: 'Vortex', fits: true },
        { id: 'draft', label: 'Draft', fits: true },
        { id: 'gale', label: 'Gale', fits: true },
        { id: 'zephyr', label: 'Zephyr', fits: true },
        { id: 'squall', label: 'Squall', fits: true },
      ],
    },
  },
  aurora: {
    type: 'button_lantern',
    config: {
      prompt: 'At Aurora’s Spirit station, press the colored buttons in the order shown here. Then watch the lanterns and enter that sequence on your phone.',
      pressPrompt: 'Wait for the station’s Ready indicator, then press these buttons in order.',
      watchPrompt: 'Watch the lanterns. Remember the colors in order.',
      enterPrompt: 'Tap the lantern colors you saw, in order.',
      partyNote: 'This station serves one party at a time. If someone else is using it, wait for Ready.',
      replayNote: 'Missed the lights? Ask the station for a replay, or show your button sequence again here and try once more.',
      hint: 'No phone-to-station connection is needed. Follow the buttons, then enter what the lanterns show.',
      retry: 'That lantern order is not quite right. Watch again, or show your button sequence and try once more.',
      success: 'Spirit awakens. Aurora’s mark joins the others, carrying your quest toward its final meeting at the Winter Keeper Throne.',
      submitLabel: 'Awaken Spirit',
      clearLabel: 'Clear',
      undoLabel: 'Undo',
      continueLabel: 'I pressed the buttons',
      replayLabel: 'Show button sequence again',
      length: SPIRIT_STATION_CONFIG.sequenceLength,
    },
  },
  builders: {
    type: 'quiz',
    config: {
      prompt: 'Optional: Take five quick multiple-choice questions to discover how an Ice Castle is built and reveal a surprising fact after each answer. Skip the quiz or play for fun; answers do not affect Castle Quest progress or Winter Keeper completion.',
      questions: [
        {
          question: 'How did Ice Castles begin?',
          choices: [
            'As a mountain resort',
            'As an ice playground Brent Christensen built for his children',
            'As a town winter festival',
            'As a school science project',
          ],
          correctIndex: 1,
          fact: 'Christensen’s children called the ice playground in his yard an ‘ice castle.’ Their neighborhood friends soon wanted to explore it too.',
        },
        {
          question: 'About how much ice can one Ice Castle use?',
          choices: ['20,000 pounds', '200,000 pounds', '2 million pounds', '20 million pounds'],
          correctIndex: 3,
          fact: 'Ice Castles’ current website lists about 20 million pounds of ice per castle. That scale takes planning, teamwork, and ongoing care.',
        },
        {
          question: 'About how many icicles does Ice Castles report growing each day?',
          choices: ['50', '500', '5,000', '50,000'],
          correctIndex: 2,
          fact: 'The current Ice Castles website reports 5,000 icicles grown every day. Each season’s castle uses hundreds of thousands of hand-placed icicles.',
        },
        {
          question: 'How do many walls and arches take shape?',
          choices: [
            'Ice artists place icicles one by one and mist them with water',
            'One giant block is carved into the whole castle',
            'Snow is packed into molds and painted',
            'Metal frames are covered with glass',
          ],
          correctIndex: 0,
          fact: 'Individual icicles are hand-placed by ice artists. Water helps join the ice, while repeated work and cold conditions let the structure grow.',
        },
        {
          question: 'Why can the weather change the build schedule?',
          choices: [
            'Wind chooses the castle’s colors',
            'Ice grows only during snowfall',
            'The team must work with changing temperatures and site conditions',
            'Warm days make icicles grow faster',
          ],
          correctIndex: 2,
          fact: 'Ice Castles is a weather-built experience. Cold supports ice growth, while warmth, rain, and changing surfaces can affect construction and operations.',
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
  ember: {
    subtitle: 'Guardian of Fire',
    body: 'Ember is warm light through cold silk — flicker without flame. Stand still in the fire realm and the heat is almost believable.',
    discover_body: 'Four colored lanterns hang in a fixed order this season. Watch them, then tap that sequence on your phone.',
    prompt: 'Tap the four lantern colors in the order you see them.',
  },
  summit: {
    subtitle: 'Guardian of Air',
    body: 'Summit lifts the gaze. Wings overhead, wind in the silk, paths that ask you to look up more than once.',
    discover_body: 'Five physical flags in this area reveal the letters of a single word. Enter what they spell.',
    prompt: 'Five flags reveal a word. Enter it.',
  },
  aurora: {
    subtitle: 'Guardian of Spirit',
    body: 'Aurora holds the quiet between lights — the moment your eyes adjust and the field comes up out of the dark.',
    discover_body: 'A physical installation plays several five-symbol Realm sequences on a loop. Repeat any one of them. The website answers on its own — no show-control hookup is required.',
    prompt: 'Watch the installation, then tap the five Realm symbols in the order you saw.',
  },
};

/** Prior Spirit challenge (symbol multi_sequence) — boot migrates to button_lantern. */
const PREVIOUS_AURORA_CHALLENGE = {
  type: 'multi_sequence',
  prompts: [
    'Aurora’s symbols bring the five elements into harmony. Find the sequence nearby, then tap the symbols on your screen in the same order.',
    'Watch the installation, then tap the five Realm symbols in the order you saw.',
  ],
};

/** Copy shipped just before elements, the Throne, and the air-rune puzzle. */
const SHIPPED_COPY = {
  threshold: {
    subtitle: 'Where the Winter Keeper tradition begins',
    body: 'Explore the castle. Discover the five Guardians — Water, Earth, Fire, Air, and Spirit — and complete their challenges in any order. When all five Realms are awake, scan The Heart to become a Winter Keeper.',
    discover_body: 'You may begin at any Castle Quest station. The Threshold is a welcome, not a gate you must find first.',
  },
  cascade: {
    subtitle: 'Water Realm · Penguin',
    body: 'Cascade is a bright-eyed penguin who sees what hurried explorers miss: a bubble caught in clear ice, a ripple held still, a reflection that shimmers like a secret window.\n\nCascade remembers the first Winter Keeper asking how a single drop could become a castle. The answer came slowly: one icicle joined to another, shaped by cold and careful hands.\n\nIn the Water Realm, pause and look into the ice. The smallest detail may hold the biggest wonder.',
  },
  granite: {
    subtitle: 'Earth Realm · Moose',
    body: 'Granite is a big-hearted moose with the memory of an old trail and the patience of a builder. He knows the castle begins before the first icicle is placed: with a place to build, a plan for people to move through it, and close attention to the ground beneath everyone’s boots.\n\nGranite leaves clues for explorers who look steadily. In the Earth Realm, notice what supports the magic, not only what sparkles above it.',
  },
  ember: {
    subtitle: 'Fire Realm · Dragon',
  },
  summit: {
    subtitle: 'Air Realm · Yeti',
    body: 'Summit is a friendly Yeti who lives where the wind has room to play. He listens for flags snapping, snow skimming across open ground, and the hush that follows a gust. His clues may be overhead or around the next bend.\n\nSummit knows that curiosity moves like the wind: it carries you toward something you had not noticed yet. In the Air Realm, lift your eyes and follow what the air sets in motion.',
    discover_body: 'Air is invisible, but winter shows where it travels. Watch a flag flutter, snow drift, or warm breath appear in the cold. Air temperature helps determine whether water can freeze and new ice can grow. Carving adds the final touches you see in the Ice Castle today. Wind also changes what builders and guests feel on site.\n\nSummit invites you to read the signs of something you cannot see by noticing what it moves.',
    prompt: 'Five flags reveal a word. Enter it.',
  },
  aurora: {
    subtitle: 'Spirit Realm · Polar Bear',
    body: 'Aurora is the Guardian of Spirit and the thread that connects the other Realms. She notices a first brave slide, a family photo that will be retold, and the quiet moment when someone stops to take in the ice.\n\nAurora knows the castle will change with the season. What lasts is the fond memories people carry with them.',
    discover_body: 'An Ice Castle is temporary by nature. Cold nights, warm days, snowfall, and the movement of guests all shape it, so no two Ice Castles are ever alike. Water, Earth, Fire, and Air help make the castle; Spirit is the curiosity, courage, laughter, and connection guests bring to it.\n\nAurora reminds us that wonder can continue as a memory, shared long after the ice has changed.',
    prompt: 'Watch the installation, then tap the five Realm symbols in the order you saw.',
  },
  builders: {
    subtitle: 'The First Winter Keeper and the craft of ice',
    body: 'Brent Christensen, First Winter Keeper, began growing castles from water, cold, and patience. This monument is optional — it does not affect becoming a Winter Keeper.',
    discover_body: 'Icicles are harvested, placed by hand, and sprayed until they fuse. Lighting, carving, and overnight growth turn a field into a castle that can hold more than twenty million pounds of ice.',
    prompt: 'A short builder quiz. There is no passing score — finish it when you are ready.',
  },
  heart: {
    title: 'Heart of Winter',
    subtitle: 'Recognition at the end of the path',
    body: 'The five Realms must already be awake. Scanning The Heart is what finishes Castle Quest — completing the last Guardian is not enough.',
    discover_body: 'If a Realm is still sleeping, this page will tell you which one. When all five are complete, the Winter Keeper finale opens here.',
  },
};

const QUEST_STATIONS = [
  {
    type: 'threshold',
    slug: 'threshold',
    title: 'The Threshold',
    subtitle: 'Where the Winter Keeper tradition begins',
    body:
      'Explore the castle. Discover the five Guardians — Water, Earth, Fire, Air, and Spirit — and complete their challenges in any order. When all five elements are awake, scan the Winter Keeper Throne to become a Winter Keeper.',
    discover_body: 'You may begin at any Castle Quest station. The Threshold is a welcome, not a gate you must find first.',
    sort_order: 0,
    poi: 'Entrance & Ticketing',
  },
  {
    type: 'guardian',
    slug: 'cascade',
    title: 'Cascade',
    subtitle: 'Guardian of Water · Penguin',
    element: 'water',
    body:
      'Cascade is a bright-eyed penguin who sees what hurried explorers miss: a bubble caught in clear ice, a ripple held still, a reflection that shimmers like a secret window.\n\nCascade remembers the first Winter Keeper asking how a single drop could become a castle. The answer came slowly: one icicle joined to another, shaped by cold and careful hands.\n\nWith Water, pause and look into the ice. The smallest detail may hold the biggest wonder.',
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
    subtitle: 'Guardian of Earth · Moose',
    element: 'earth',
    body:
      'Granite is a big-hearted moose with the memory of an old trail and the patience of a builder. He knows the castle begins before the first icicle is placed: with a place to build, a plan for people to move through it, and close attention to the ground beneath everyone’s boots.\n\nGranite leaves clues for explorers who look steadily. With Earth, notice what supports the magic, not only what sparkles above it.',
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
    subtitle: 'Guardian of Fire · Dragon',
    element: 'fire',
    body:
      'Ember is a dragon who belongs in the snow. He loves the moment blue ice turns gold and lantern light dances across a frozen wall. Bold and a little mischievous, Ember knows fire and ice can share a story without one conquering the other.\n\nHe also honors the creative fire in the hearts of Ice Castles artisans: the imagination and purpose that help keep them warm in spirit through the coldest nights as they shape the castle. Watch closely; Ember’s clues flicker and change.',
    discover_body:
      'Fire does not have to mean a flame inside the castle. Here, light changes how guests see ice: it reveals color, bubbles, shadows, and texture that daylight may hide. Ember also celebrates the creative fire artisans carry as they bring the castle to life. Their imagination and purpose keep them warm in spirit through the coldest nights.\n\nTemperature matters too; cold helps water freeze, while warmth can change or limit the build. After dark, the same passage can feel like a different place.\n\nEmber asks explorers to notice how contrast brings the frozen world to life.',
    sort_order: 3,
    poi: 'Mystic Forest — Fire',
    challenge: CHALLENGES.ember,
  },
  {
    type: 'guardian',
    slug: 'summit',
    title: 'Summit',
    subtitle: 'Guardian of Air · Yeti',
    element: 'air',
    body:
      'Summit is a friendly Yeti who lives where the wind has room to play. He listens for flags snapping, snow skimming across open ground, and the hush that follows a gust. His clues may be overhead or around the next bend.\n\nSummit knows that curiosity moves like the wind: it carries you toward something you had not noticed yet. With Air, lift your eyes and follow what the wind sets in motion.',
    discover_body:
      'Air is invisible, but winter shows where it travels. Watch a flag flutter, snow drift, or warm breath appear in the cold. Cold air helps water freeze and new ice grow; wind and changing temperatures also shape when and how builders can work. When the structure is ready, artisans carve details that give the Ice Castle its final character.\n\nSummit invites you to read the signs of something you cannot see by noticing what it moves.',
    sort_order: 4,
    poi: 'Mystic Forest — Air',
    challenge: CHALLENGES.summit,
  },
  {
    type: 'guardian',
    slug: 'aurora',
    title: 'Aurora',
    subtitle: 'Guardian of Spirit · Polar Bear',
    element: 'spirit',
    body:
      'Aurora is the Guardian of Spirit, the spark of wonder that connects the elements and everyone who visits. She notices a first brave slide, a family photo that will be retold, and the quiet moment when someone stops to take in the ice.\n\nAurora knows the castle will change with the season. What lasts is the fond memories people carry with them.',
    discover_body:
      'An Ice Castle changes with the season. Cold nights, warm days, snowfall, and the movement of guests shape it, so each season is different. Water, Earth, Fire, and Air shape the frozen structure; Spirit is the curiosity, courage, laughter, and connection people bring to the experience.\n\nAurora’s station uses colored buttons and lanterns. Your phone shows which buttons to press; the station answers with lanterns; you enter that lantern order. The phone and station share the same mapping table — they do not connect over the network.\n\nAurora reminds us that wonder can continue as a memory, shared long after the ice has changed.',
    sort_order: 5,
    poi: 'Mystic Forest — Spirit',
    challenge: CHALLENGES.aurora,
  },
  {
    type: 'monument',
    slug: 'builders',
    title: 'Builder’s Monument',
    subtitle: 'Optional discovery',
    body:
      'Ice Castles began with a father trying to give his six children a winter adventure. One wintery night, a fierce storm engulfed Alpine, Utah. In the still of the morning, Brent Christensen was standing at his kitchen window when he noticed newly formed icicles covering his children’s playground, sparkling in the early morning sunlight. Inspired, Brent Christensen built an ice playground in his yard. The children called it an ‘ice castle,’ and neighborhood families soon came to explore.\n\nThat small family creation grew into a winter attraction built anew each season. Today, more than 50 Ice Castles have risen across North America and millions of guests just like you have discovered the magic of Ice Castles.\n\nThe Builder’s Monument honors the passionate winter artisans who turn a simple idea into a place guests can enter, explore, and make lasting memories. This stop is optional and does not affect becoming a Winter Keeper.',
    discover_body:
      'An Ice Castle is assembled through many careful steps. Teams plan around the site and the weather. Icicles are grown, harvested, and carried up and into the structure, where ice artisans place them one by one to shape walls, arches, tunnels, and towers. Water is misted over the structure to help the ice fuse and grow.\n\nThen the team keeps tending it: checking conditions, adding ice, shaping spaces, and caring for guest routes as the castle changes. The work calls for coordination, patience, physical skill, and constant attention to winter.\n\nThe finished walls may look like a single frozen wonder, but look closely and you can see the individual icicles and layers that make it.',
    sort_order: 6,
    poi: 'The Ice Castle',
    challenge: CHALLENGES.builders,
  },
  {
    type: 'heart',
    slug: 'heart',
    title: 'Winter Keeper Throne',
    subtitle: 'Final scan and the medallion',
    body:
      'The Winter Keeper Throne is the final scan. Awaken all five elements first, then scan here to confirm your quest and become a Winter Keeper. If an element is still sleeping, this page lists what remains. When you are ready, an optional group photo here is welcome, and the Gift Shop redeems your medallion from the completion screen.',
    discover_body:
      'Scanning the Throne confirms the quest. Completing the last Guardian is not enough on its own.',
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
    'SELECT id, name, slug, marker, sort_order, x, y FROM pois WHERE adventure_id = ?',
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
      const slug = slugify(pin.name);
      const existing = byName.get(pin.name)
        || pois.find((p) => p.slug === slug || slugify(p.name) === slug);
      if (existing) {
        byName.set(pin.name, existing);
        continue;
      }
      sort += 1;
      const id = uuid();
      const at = placeForestPin(pin, slots);
      await db.run(
        `INSERT INTO pois
           (id, adventure_id, name, slug, category, zone, blurb, description, fun_fact, image_url,
            x, y, scan_code, published, sort_order, marker, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, adventureId, pin.name, slug, 'sculpture', 'Mystic Forest',
          pin.blurb, pin.description, null, null,
          at.x, at.y, await uniqueScanCode(), 1, sort, pin.marker, ts, ts,
        ]
      );
      const row = { id, name: pin.name, slug, marker: pin.marker, sort_order: sort, x: at.x, y: at.y };
      pois.push(row);
      byName.set(pin.name, row);
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
      'SELECT id, poi_id, title, subtitle, body, discover_body, challenge_type, config FROM touchpoints WHERE adventure_id = ? AND slug = ?',
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
    const shipped = SHIPPED_COPY[tp.slug];
    const copyMatches = (snap) => snap
      && (!snap.subtitle || row.subtitle === snap.subtitle)
      && (!snap.body || row.body === snap.body)
      && (!snap.discover_body || row.discover_body === snap.discover_body);
    const titleMatches = (snap) => snap && snap.title && row.title === snap.title;
    if (copyMatches(previous) || copyMatches(shipped) || titleMatches(shipped)) {
      await db.run(
        'UPDATE touchpoints SET title = ?, subtitle = ?, body = ?, discover_body = ?, updated_at = ? WHERE id = ?',
        [tp.title, tp.subtitle, tp.body, tp.discover_body || null, ts, row.id]
      );
    }
    if (tp.challenge && row.config) {
      let cfg = null;
      try { cfg = JSON.parse(row.config); } catch { cfg = null; }
      const oldPrompt = cfg && (
        cfg.prompt === previous?.prompt
        || cfg.prompt === shipped?.prompt
        || cfg.code === 'CARVE'
        || cfg.questions?.[0]?.question === 'What is an Ice Castle grown from?'
      );
      const needsLines = cfg && tp.challenge.config.retry && cfg.prompt === tp.challenge.config.prompt && !cfg.retry;
      const oldSummitPieces = tp.slug === 'summit' && cfg && (
        (cfg.correctIds || []).map(String).sort().join('|') === 'barb|drift|gust|hush'
        || (cfg.pieces || []).some((piece) => piece.id === 'gust' || piece.id === 'block')
      );
      const oldCascadeArt = tp.slug === 'cascade' && cfg && Array.isArray(cfg.images) && cfg.images.some(
        (img) => typeof img?.url === 'string' && img.url.endsWith('.png')
      );
      const oldAuroraSpirit = tp.slug === 'aurora' && (
        row.challenge_type !== 'button_lantern'
        || !cfg?.pressPrompt
        || !cfg?.enterPrompt
        || row.challenge_type === PREVIOUS_AURORA_CHALLENGE.type
        || PREVIOUS_AURORA_CHALLENGE.prompts.includes(cfg?.prompt)
        || (Array.isArray(cfg?.accepted) && cfg.kind === 'symbol')
      );
      if (cfg && (oldPrompt || needsLines || oldSummitPieces || oldCascadeArt || oldAuroraSpirit)) {
        const next = (oldPrompt || oldSummitPieces || oldAuroraSpirit)
          ? tp.challenge.config
          : oldCascadeArt
            ? { ...cfg, images: tp.challenge.config.images }
            : { ...cfg, retry: tp.challenge.config.retry, success: tp.challenge.config.success };
        await db.run(
          'UPDATE touchpoints SET challenge_type = ?, config = ?, updated_at = ? WHERE id = ?',
          [tp.challenge.type, JSON.stringify(next), ts, row.id]
        );
      }
    } else if (tp.slug === 'aurora' && tp.challenge && row.challenge_type !== 'button_lantern') {
      // No parseable config — still force the Spirit station onto button_lantern.
      await db.run(
        'UPDATE touchpoints SET challenge_type = ?, config = ?, updated_at = ? WHERE id = ?',
        [tp.challenge.type, JSON.stringify(tp.challenge.config), ts, row.id]
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
  const redemption = 'Show this screen at the Gift Shop to receive your Winter Keeper medallion.';
  const oldRedemptions = [
    'Show this badge at the Warming Hut to claim your Winter Keeper pin.',
    'Show this badge at the Warming Hut to claim your pin.',
  ];
  for (const old of oldRedemptions) {
    await db.run(
      'UPDATE adventures SET badge_redemption = ? WHERE badge_redemption = ?',
      [redemption, old]
    );
  }
  await db.run(
    `UPDATE adventures SET badge_body = ?
      WHERE badge_body = ?`,
    [
      'You met the Guardians, awakened the five elements, and were named a Winter Keeper.',
      'You walked the Threshold, met the Guardians, and carried light to the Heart of Winter.',
    ]
  );
  await db.run(
    `UPDATE adventures SET welcome_body = ?
      WHERE welcome_body = ?`,
    [
      'Explore the castle. Discover the five Guardians, complete their challenges in any order, then scan the Winter Keeper Throne to become a Winter Keeper.',
      'Explore the castle. Discover the five Guardians, complete their challenges in any order, then scan The Heart to become a Winter Keeper.',
    ]
  );
  return total;
}

module.exports = {
  CHALLENGES,
  QUEST_STATIONS,
  POI_MARKERS,
  ensureQuestStations,
  ensureQuestStationsAll,
};
