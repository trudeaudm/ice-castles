/* global window, document, Store, ParkMap, Scanner */

const ART = '/assets/art';
const REALM_META = {
  water: { label: 'Water', glyph: '💧', character: `${ART}/char-cascade.png`, pfp: `${ART}/pfp-cascade.png`, wave: `${ART}/wave-cascade.mp4` },
  earth: { label: 'Earth', glyph: '🪨', character: `${ART}/char-granite.png`, pfp: `${ART}/pfp-granite.png`, wave: `${ART}/wave-granite.mp4` },
  fire: { label: 'Fire', glyph: '🔥', character: `${ART}/char-ember.png`, pfp: `${ART}/pfp-ember.png`, wave: `${ART}/wave-ember.mp4` },
  air: { label: 'Air', glyph: '🌬️', character: `${ART}/char-summit.png`, pfp: `${ART}/pfp-summit.png`, wave: `${ART}/wave-summit.mp4` },
  spirit: { label: 'Spirit', glyph: '✦', character: `${ART}/char-aurora.png`, pfp: `${ART}/pfp-aurora.png`, wave: `${ART}/wave-aurora.mp4` },
};
/* Head crop inside the landing circle: source square as a fraction of frame width, top as a fraction of frame height. */
const WAVE_FACE = {
  water: { zoom: 0.72, top: 0.02 },
  earth: { zoom: 0.78, top: 0.0 },
  fire: { zoom: 0.7, top: 0.02 },
  air: { zoom: 0.7, top: 0.0 },
  spirit: { zoom: 0.72, top: 0.01 },
};
const REALM_ORDER = ['water', 'earth', 'fire', 'air', 'spirit'];
const TILE_ART = {
  'ice-vein': `${ART}/cascade-ice-vein.png`,
  'lantern-glow': `${ART}/cascade-lantern-glow.png`,
  'ice-arch': `${ART}/cascade-ice-arch.png`,
  'silk-wing': `${ART}/cascade-silk-wing.png`,
  'ice-ripple': `${ART}/cascade-ice-ripple.png`,
  'rune-cut': `${ART}/cascade-rune-cut.png`,
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
function stationArt(station) {
  if (station.element && REALM_META[station.element]) return realmCharacter(station.element);
  if (station.imageUrl) return station.imageUrl;
  if (station.type === 'heart' || station.type === 'monument') return `${ART}/landing-gate.webp`;
  return '';
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
  stationView: el('stationView'),
  guideToggle: el('guideToggle'), headerMap: el('headerMap'), guide: el('guide'),
  sheet: el('sheet'), sheetBody: el('sheetBody'), sheetGrip: el('sheetGrip'),
  journeyPanel: el('journeyPanel'), journeyBody: el('journeyBody'),
  passportPanel: el('passportPanel'), passportBody: el('passportBody'),
  toast: el('toast'), splash: el('bootSplash'),
  scanFab: el('scanFab'), recenter: el('recenterButton'),
  filterButton: el('filterButton'), legend: el('legend'), legendRows: el('legendRows'),
  journeyButton: el('journeyButton'),
  threshold: el('threshold'), thresholdStart: el('thresholdStart'),
  landingPlace: el('landingPlace'), landingProgress: el('landingProgress'),
  landingHow: el('landingHow'), landingMap: el('landingMap'),
  landingHowto: el('landingHowto'), landingHowtoBody: el('landingHowtoBody'),
  landingHowtoClose: el('landingHowtoClose'),
  landingTalk: el('landingTalk'), landingBubble: el('landingBubble'),
  landingBubbleWho: el('landingBubbleWho'), landingBubbleText: el('landingBubbleText'),
  landingRealms: el('landingRealms'),
  mapModal: el('mapModal'), mapModalEyebrow: el('mapModalEyebrow'),
  mapModalTitle: el('mapModalTitle'), mapModalBody: el('mapModalBody'),
  mapModalPrimary: el('mapModalPrimary'), mapModalGhost: el('mapModalGhost'),
  finale: el('finale'), finaleCard: el('finaleCard'),
  award: el('award'), awardGlyph: el('awardGlyph'), awardTitle: el('awardTitle'),
  awardMeta: el('awardMeta'), awardKicker: el('awardKicker'), awardPips: el('awardPips'),
  awardDone: el('awardDone'),
};

let currentPanel = null;
let awardQueue = [];
let awardShowing = false;
let mapReady = false;
let selectedImages = new Set();
let sequenceBuffer = [];
let shrineFocus = null;
let shrineSlug = null;
let mapModalMode = null;
let mapModalStation = null;

const ICON_MEET = `<img src="${ART}/icon-meet.png" alt="">`;
const ICON_DISCOVER = `<img src="${ART}/icon-discover.png" alt="">`;
const ICON_PLAY = `<img src="${ART}/icon-play.png" alt="">`;

function setShrineFocus(key, { spin = true } = {}) {
  stopStoryAudio();
  shrineFocus = key;
  const gate = document.querySelector('.shrineGate');
  if (!gate) return;
  gate.dataset.focus = key;
  gate.classList.add('is-focus');
  if (spin) {
    gate.classList.remove('is-spinning');
    void gate.offsetWidth;
    gate.classList.add('is-spinning');
  }
  gate.querySelectorAll('[data-shrine-focus]').forEach((btn) => {
    btn.classList.toggle('is-on', btn.dataset.shrineFocus === key);
  });
  document.querySelectorAll('.shrinePanel').forEach((panel) => {
    panel.classList.toggle('is-open', panel.dataset.panel === key);
  });
}

function toast(message, { warm = false, ms = 3200 } = {}) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle('is-warm', warm);
  dom.toast.classList.add('is-on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => dom.toast.classList.remove('is-on'), ms);
}

function goStation(slug) {
  const path = Store.stationPath(slug);
  if (`${location.pathname}` !== path) history.pushState({ station: slug }, '', path);
  Store.state.path = Store.pathContext();
  hideMapModal();
  openStation(slug);
}

function goVenueHome() {
  const path = Store.stationPath(null);
  if (`${location.pathname}` !== path) history.replaceState({ station: null }, '', path);
  Store.state.path = Store.pathContext();
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
  dom.questProgress.textContent = `${awakened} of 5 Realms Awakened`;
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
      ? `<div class="challenge"><p class="challenge__prompt">This Realm is awake. Find the others, then scan The Heart.</p></div>`
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
    const tiles = (challenge.images || []).map((img) => {
      const url = img.url || TILE_ART[img.id] || '';
      return `<button class="pickTile${url ? ' pickTile--art' : ''}" data-image-id="${escapeHtml(img.id)}" type="button" style="--tile:${escapeHtml(img.color || '#5df0cf')}">
        ${url ? `<img src="${escapeHtml(url)}" alt="">` : ''}
        <span>${escapeHtml(img.label || img.id)}</span>
      </button>`;
    }).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${challenge.hint ? `<p class="challenge__hint">${escapeHtml(challenge.hint)}</p>` : ''}
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

  if (type === 'quiz') {
    const questions = (challenge.questions || []).map((q, qi) => `
      <fieldset class="quizQ">
        <legend>${escapeHtml(q.question)}</legend>
        ${(q.choices || []).map((c, ci) =>
          `<label class="quizChoice"><input type="radio" name="q${qi}" value="${ci}"> ${escapeHtml(c)}</label>`
        ).join('')}
      </fieldset>`).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      ${questions}
      <button class="textButton textButton--play" data-quiz-submit type="button">Finish quiz</button>
    </div>`;
  }

  return '';
}

function shrineMeetTitle(station) {
  if (station.type === 'guardian') return 'Meet the Guardian';
  if (station.type === 'monument') return 'Meet the builders';
  if (station.type === 'heart') return 'Meet the Heart';
  return `Meet ${station.title}`;
}

function shrineDiscoverTitle(station) {
  if (station.type === 'guardian') return 'Discover the Element';
  return 'Discover';
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

function hearthSvg() {
  const left = `M0,200 L0,146
    C18,136 12,100 26,78
    C34,62 20,36 26,16
    C30,4 24,0 36,8
    C50,18 42,40 50,64
    C60,96 78,118 92,124
    C108,118 112,86 116,58
    C120,34 108,12 118,2
    C126,-6 146,4 144,20
    C142,40 132,66 144,96
    C156,124 178,132 194,120
    C208,108 210,74 214,48
    C218,24 206,6 220,0
    C232,-6 250,8 246,26
    C242,48 232,78 246,108
    C262,136 286,140 300,132
    L300,200 Z`;
  const right = `M180,200 L180,136
    C196,124 188,90 206,64
    C216,46 202,22 214,6
    C222,-4 216,-2 228,8
    C242,20 234,42 242,66
    C252,98 270,120 286,124
    C302,116 306,84 310,56
    C314,32 302,10 314,0
    C322,-8 342,2 340,18
    C338,38 328,64 340,94
    C352,122 374,130 390,116
    C404,104 406,70 410,44
    C414,20 402,4 416,0
    C428,-4 446,10 442,28
    C438,50 428,80 442,108
    C458,134 472,128 480,118
    L480,200 Z`;
  const band = (d, delay) => `<g class="lick" style="animation-delay:${delay}">
    <path fill="#ff2e00" d="${d}"/>
    <g transform="translate(0 200) scale(1 0.78) translate(0 -200)"><path fill="#ff7410" d="${d}"/></g>
    <g transform="translate(0 200) scale(1 0.56) translate(0 -200)"><path fill="#ffc20a" d="${d}"/></g>
    <g transform="translate(0 200) scale(1 0.34) translate(0 -200)"><path fill="#fff4a8" d="${d}"/></g>
  </g>`;
  return `<svg class="hearth" viewBox="0 0 480 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    ${band(left, '0s')}
    ${band(right, '-0.4s')}
    <rect x="0" y="186" width="480" height="14" fill="#ffe14a"/>
  </svg>`;
}

function realmSkyHtml(element) {
  if (element === 'fire') {
    const embers = '<span class="ember"></span>'.repeat(14);
    return `<div class="realmSky" aria-hidden="true">${hearthSvg()}${embers}</div>`;
  }
  if (element === 'air') return airSkyHtml();
  return `<div class="realmSky" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
}

function airSkyHtml() {
  const arm = `M24,70 C8,56 10,34 28,26 C46,18 64,32 60,48 C56,62 42,66 40,54`;
  const arms = [0, 120, 240].map((deg, i) => `<g transform="rotate(${deg} 50 50)">
      <path class="wind__shape" pathLength="100" d="${arm}"/>
      <path class="wind__mote" pathLength="100" style="animation-delay:${(-i * 0.75).toFixed(2)}s" d="${arm}"/>
    </g>`).join('');
  const coil = `M54.0,50.0 L54.4,49.4 L54.6,48.8 L54.8,48.0 L54.8,47.2 L54.7,46.4 L54.5,45.5 L54.1,44.6 L53.6,43.8 L52.9,43.0 L52.1,42.3 L51.1,41.7 L50.0,41.3 L48.8,40.9 L47.5,40.8 L46.2,40.8 L44.8,41.1 L43.5,41.5 L42.1,42.1 L40.9,43.0 L39.7,44.0 L38.6,45.3 L37.7,46.7 L37.0,48.3 L36.5,50.0 L36.2,51.8 L36.2,53.7 L36.4,55.6 L36.9,57.5 L37.7,59.4 L38.8,61.2 L40.1,62.9 L41.7,64.4 L43.5,65.8 L45.5,66.9 L47.7,67.7 L50.0,68.3 L52.4,68.5 L54.9,68.4 L57.4,68.0 L59.9,67.2 L62.3,66.0 L64.6,64.6 L66.7,62.8 L68.5,60.7 L70.2,58.3 L71.5,55.7 L72.4,53.0 L73.0,50.0 L73.2,46.9 L73.0,43.8 L72.3,40.7 L71.3,37.7 L69.8,34.8 L67.9,32.1 L65.7,29.6 L63.1,27.3 L60.2,25.5 L57.0,24.0 L53.6,22.9 L50.0,22.3 L46.3,22.1 L42.6,22.4 L38.9,23.3 L35.3,24.6 L31.9,26.4 L28.7,28.7 L25.8,31.4 L23.2,34.5 L21.1,38.0 L19.4,41.8 L18.2,45.8 L17.5,50.0 L17.4,54.3 L17.8,58.6 L18.9,62.9 L20.5,67.0 L22.6,71.0 L25.3,74.7 L28.5,78.0 L32.2,80.9 L36.2,83.3 L40.6,85.2 L45.2,86.5 L50.0,87.3 L54.9,87.3 L59.8,86.7 L64.7,85.5 L69.4,83.6 L73.9,81.1 L78.0,78.0 L81.8,74.4 L85.0,70.2 L87.7,65.6 L89.8,60.7 L91.2,55.4 L92.0,50.0 L108,50`;
  const curl = `<svg class="wind wind--curl" viewBox="0 0 100 100"><g class="wind__spin">${arms}</g></svg>`;
  const coilSvg = `<svg class="wind wind--coil" viewBox="0 0 100 100"><g class="wind__spin"><path class="wind__shape" pathLength="100" d="${coil}"/><path class="wind__mote" pathLength="100" d="${coil}"/></g></svg>`;
  return `<div class="realmSky" aria-hidden="true">${curl}${coilSvg}${curl}${coilSvg}${curl}</div>`;
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

function renderStation(slug) {
  stopStoryAudio();
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
    shrineFocus = null;
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
  const artHtml = art
    ? (waveRealm
      ? `<div class="shrine__hero"><img class="shrine__art" src="${escapeHtml(art)}" alt=""></div>`
      : `<img class="shrine__art" src="${escapeHtml(art)}" alt="">`)
    : '';

  if (!gated) {
    dom.stationView.innerHTML = `
      <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
        <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
        <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
        ${artHtml}
        <section class="shrine__block">
          <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
          ${storyHtml(station.body)}
        </section>
        ${station.discoverBody ? `<section class="shrine__block">
          <h3>${escapeHtml(shrineDiscoverTitle(station))}</h3>
          ${storyHtml(station.discoverBody)}
        </section>` : ''}
        <div id="heartSlot"></div>
      </article>`;
    if (station.type === 'heart') renderHeartSlot();
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
        <button class="shrineIcon" data-shrine-focus="meet" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_MEET}</span>
          <span class="shrineIcon__label">Meet</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="discover" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_DISCOVER}</span>
          <span class="shrineIcon__label">Discover</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="play" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem shrineIcon__gem--play">${ICON_PLAY}</span>
          <span class="shrineIcon__label">Play</span>
        </button>
      </div>
      <section class="shrinePanel" data-panel="meet">
        <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
        ${station.type === 'guardian' ? listenButtonHtml(station.audioUrl) : ''}
        ${portrait ? `<img class="shrine__portrait" src="${escapeHtml(portrait)}" alt="">` : ''}
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
  if (shrineFocus) setShrineFocus(shrineFocus, { spin: false });
  if (waveRealm && !document.body.classList.contains('landing-open')) armShrineWaves(waveRealm);
}

async function openStation(slug, { recordVisit = true } = {}) {
  hideThreshold();
  hideMapModal();
  closePanels();
  closeGuide({ force: true });
  Store.setIntendedStation(slug);
  renderStation(slug);
  if (recordVisit && Store.hasLiveSession() && slug) {
    try { await Store.visitStation(slug); renderProgress(); } catch { /* offline */ }
    if (slug === 'heart' || Store.touchBySlug(slug)?.type === 'heart') {
      const result = await Store.scanHeart();
      renderStation(slug);
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

  const remaining = (heartResult?.remaining)
    || (session.realms || []).filter((r) => !r.complete).map((r) => r.realm);

  if (remaining.length) {
    const names = remaining.map((r) => REALM_META[r]?.label || r);
    const icons = remaining.map((r) =>
      `<li><img src="${realmPfp(r)}" alt=""><span>${escapeHtml(REALM_META[r]?.label || r)}</span></li>`
    ).join('');
    slot.innerHTML = `<div class="challenge">
      <p class="challenge__prompt">The Heart is still sleeping. ${names.length === 1 ? 'This Realm' : 'These Realms'} remain:</p>
      <ul class="remainList">${icons}</ul>
      <button class="textButton" data-open-journey type="button">View my journey</button>
    </div>`;
    return;
  }

  slot.innerHTML = keepersFormHtml();
}

function keepersFormHtml() {
  return `<form class="challenge keepers" id="keepersForm">
    <p class="challenge__prompt">The Heart is open. Enter the Winter Keepers in your party.</p>
    <label>How many adventurers?
      <input class="challenge__input" name="partySize" type="number" min="1" max="20" value="1" required>
    </label>
    <label>First names
      <input class="challenge__input" name="names" placeholder="Ada, Sam, Juniper" required>
    </label>
    <label>Email for the digital seal (optional)
      <input class="challenge__input" name="email" type="email" autocomplete="email">
    </label>
    <label class="check">
      <input type="checkbox" name="marketing">
      <span>Also send Ice Castles news to this address. Separate from the digital reward.</span>
    </label>
    <button class="threshold__primary threshold__primary--earned" type="submit">Become Winter Keepers</button>
  </form>`;
}

function staffScreenHtml(session) {
  const names = session.keeperNames || [];
  const park = Store.state.park || {};
  return `<div class="staffCard">
    <p class="staffCard__kicker">Show this at the Gear Shop</p>
    <h3>Winter Keepers</h3>
    <p class="staffCard__names">${escapeHtml(names.join(' · ') || 'This party')}</p>
    <p class="staffCard__count">${session.partySize || names.length || 1} adventurer${(session.partySize || 1) === 1 ? '' : 's'}</p>
    <p class="fineprint">${escapeHtml(park.badgeRedemption || 'One physical reward per adventurer.')}</p>
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
  const partySize = Number(form.partySize.value || names.length || 1);
  await Store.finishQuest({
    names,
    partySize,
    email: form.email.value || null,
    marketingOptIn: form.marketing.checked,
  });
  renderProgress();
  renderHeartSlot();
  showFinale();
}

function showFinale() {
  const session = Store.state.session;
  if (!session?.winterKeeper) return;
  dom.finaleCard.innerHTML = `
    <div class="finaleStage">
      ${sealHtml(session)}
      <p class="finaleStage__lead">The castle knows your names. Continue, then show the next screen at the Gear Shop.</p>
      <button class="threshold__primary threshold__primary--earned finaleStage__btn" data-show-reward type="button">Continue</button>
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
    else if (tp.complete) status = 'Realm awake';
    return `<li>
      <button class="stop ${tp.complete || (tp.type === 'heart' && session?.winterKeeper) ? 'is-found' : 'is-secret'}" data-go-station="${escapeHtml(tp.slug)}" type="button">
        <span class="stop__token">${
          tp.element
            ? `<img src="${realmPfp(tp.element)}" alt="">`
            : (tp.type === 'heart' ? `<img src="${ART}/seal-winter-keeper.png" alt="">` : tp.type === 'monument' ? `<img src="${ART}/pin-park.png" alt="">` : '◇')
        }</span>
        <span>
          <p class="stop__name">${escapeHtml(tp.title)}</p>
          <p class="stop__hint">${escapeHtml(status)}</p>
        </span>
      </button>
    </li>`;
  }).join('');

  dom.journeyBody.innerHTML = `
    <p class="sectionLabel">Castle Quest</p>
    <p class="fineprint" style="margin-bottom:16px">${Store.realmsAwakened()} of 5 Realms Awakened. Builder’s Monument is optional. The Heart finishes the quest.</p>
    <ul class="stopList">${rows}</ul>`;
}

function openPanel(name) {
  closeGuide();
  ['journeyPanel', 'passportPanel'].forEach((key) => {
    if (!dom[key]) return;
    dom[key].hidden = true;
    dom[key].classList.remove('is-open');
  });
  if (name === 'journey') { renderJourney(); showPanel(dom.journeyPanel); }
  else if (name === 'passport') { renderPassport(); showPanel(dom.passportPanel); }
  currentPanel = name;
  document.body.classList.add('panel-open');
}

function showPanel(panel) {
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function closePanels() {
  ['journeyPanel', 'passportPanel'].forEach((key) => {
    if (!dom[key]) return;
    dom[key].classList.remove('is-open');
    setTimeout(() => { dom[key].hidden = true; }, 440);
  });
  currentPanel = null;
  document.body.classList.remove('panel-open');
}

function renderPassport() {
  const session = Store.state.session;
  const park = Store.state.park || {};
  dom.passportBody.innerHTML = session?.winterKeeper
    ? `${staffScreenHtml(session)}<p class="fineprint">${escapeHtml(park.badgeBody || '')}</p>`
    : `<div class="empty">
        <h3 class="empty__title">Not a Winter Keeper yet</h3>
        <p class="empty__body">Awaken five Realms, then scan The Heart. Progress lasts until 4 AM Eastern.</p>
      </div>`;
}

/* -------------------------------------------------------------------------- */
/* threshold / guide                                                          */
/* -------------------------------------------------------------------------- */

const LANDING_FACTS = {
  water: [
    { who: 'Cascade', text: 'Water is the trickiest ice to grow — it has to look like it’s still pouring!' },
    { who: 'Cascade', text: 'Hunt for veins, ripples, and arches pressed into the walls beside you.' },
    { who: 'Cascade', text: 'The lights in this realm cycle like a current under the ice.' },
  ],
  earth: [
    { who: 'Granite', text: 'The runes are carved, not printed — they change as you walk past.' },
    { who: 'Granite', text: 'A single archway can take two people most of a night to grow.' },
    { who: 'Granite', text: 'Four moose hide nearby. Each one holds a letter of a builder’s word.' },
  ],
  fire: [
    { who: 'Ember', text: 'Nothing here is actually burning — amber silk and LEDs do the flicker.' },
    { who: 'Ember', text: 'Three dragons roost on the horse path. Count the fire lizards if you can!' },
    { who: 'Ember', text: 'Those lizards are printed in-house. No two sit the same way twice.' },
  ],
  air: [
    { who: 'Summit', text: 'A finished castle can hold more than twenty million pounds of ice.' },
    { who: 'Summit', text: 'Artists harvest icicles by hand each night, then spray them until they fuse.' },
    { who: 'Summit', text: 'Look up in the Aviary — every silk bird is painted by hand, and no two match.' },
  ],
  spirit: [
    { who: 'Aurora', text: 'The Tundra stays dark on purpose. Give your eyes thirty seconds.' },
    { who: 'Aurora', text: 'Everything you see was grown, not built — water, cold, and time.' },
    { who: 'Aurora', text: 'Fairy Village doors are kid-height, and every silk is a different color.' },
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
let waveBag = [];
let waveLast = '';

function nextWaveRealm() {
  if (!waveBag.length) {
    waveBag = REALM_ORDER.filter((realm) => realm !== waveLast);
    for (let i = waveBag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [waveBag[i], waveBag[j]] = [waveBag[j], waveBag[i]];
    }
  }
  waveLast = waveBag.pop();
  return waveLast;
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
}

async function runWave(realm, mode, paintHost, wavingHost, gen) {
  const video = waveVideoEl();
  silenceWave(video);
  await loadWave(video, realm);
  if (gen !== waveGen || !paintHost.isConnected) return;
  silenceWave(video);
  if (video.currentTime > 0.04) {
    await new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
      try { video.currentTime = 0; } catch { resolve(); }
    });
  }
  if (gen !== waveGen || !paintHost.isConnected) return;
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
    return;
  }
  paintWaveFrame(canvas, video, mode, realm);
  wavingHost.classList.add('is-waving');
  try {
    await video.play();
  } catch {
    wavingHost.classList.remove('is-waving');
    canvas.remove();
    return;
  }
  silenceWave(video);
  const natural = await new Promise((resolve) => {
    let safety = 0;
    const finish = (ok) => {
      window.clearTimeout(safety);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('pause', onPause);
      resolve(ok);
    };
    const onEnd = () => finish(gen === waveGen);
    const onPause = () => {
      if (gen !== waveGen || video.ended) finish(gen === waveGen && video.ended);
    };
    video.addEventListener('ended', onEnd);
    video.addEventListener('pause', onPause);
    safety = window.setTimeout(() => finish(false), 8000);
    const draw = () => {
      if (gen !== waveGen || video.ended || !canvas.isConnected) return;
      if (!video.muted || video.volume !== 0) silenceWave(video);
      paintWaveFrame(canvas, video, mode, realm);
      waveRaf = window.requestAnimationFrame(draw);
    };
    waveRaf = window.requestAnimationFrame(draw);
  });
  wavingHost.classList.remove('is-waving');
  if (natural) await new Promise((resolve) => window.setTimeout(resolve, 220));
  if (canvas.isConnected) canvas.remove();
}

function landingCanWave() {
  return document.body.classList.contains('landing-open')
    && Boolean(dom.threshold?.classList.contains('is-open'))
    && !(dom.landingHowto && !dom.landingHowto.hidden);
}

function armLandWaves() {
  const gen = waveGen;
  const tick = (delay) => {
    window.clearTimeout(waveTimer);
    waveTimer = window.setTimeout(async () => {
      if (gen !== waveGen) return;
      if (!landingCanWave()) {
        tick(900);
        return;
      }
      const realm = nextWaveRealm();
      const btn = document.querySelector(`.landing__realm[data-realm="${realm}"]`);
      const face = btn?.querySelector('.landing__face');
      if (face) {
        try { await runWave(realm, 'face', face, btn, gen); } catch { /* skip */ }
      }
      if (gen !== waveGen) return;
      tick(2400 + Math.random() * 2600);
    }, delay);
  };
  tick(1400);
}

function startLandWaves() {
  haltWaves();
  armLandWaves();
}

function armShrineWaves(realm) {
  const gen = waveGen;
  const tick = (delay) => {
    window.clearTimeout(waveTimer);
    waveTimer = window.setTimeout(async () => {
      if (gen !== waveGen) return;
      const hero = document.querySelector('.shrine__hero');
      if (!hero || document.body.dataset.realm !== realm) return;
      try { await runWave(realm, 'hero', hero, hero, gen); } catch { /* try later */ }
      if (gen !== waveGen) return;
      tick(11000 + Math.random() * 9000);
    }, delay);
  };
  tick(3800 + Math.random() * 2200);
}

function hideLandTalk() {
  document.querySelectorAll('.landing__realm.is-talking').forEach((n) => n.classList.remove('is-talking'));
  if (!dom.landingTalk) return;
  dom.landingTalk.hidden = true;
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
}

function startLandTalk() {
  stopLandTalk();
  talkDelay = window.setTimeout(() => {
    if (dom.threshold?.classList.contains('is-open')) landTalk('water');
    talkPulse = window.setInterval(() => {
      if (!dom.threshold?.classList.contains('is-open')) return;
      if (dom.landingHowto && !dom.landingHowto.hidden) return;
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

function showThreshold() {
  const tp = Store.touchByType('threshold')[0];
  const park = Store.state.park || {};
  if (dom.landingPlace) {
    dom.landingPlace.textContent = park.locationName || park.name || 'Ice Castles';
  }
  if (dom.landingProgress) {
    dom.landingProgress.textContent = `${Store.realmsAwakened()} / 5 Realms Awakened`;
  }
  if (dom.landingHowtoBody) {
    const story = tp?.body || park.welcomeBody ||
      'Explore the castle, complete five Guardian challenges in any order, then scan The Heart.';
    const discover = tp?.discoverBody ||
      'Guardians can be done in any order. The Heart finishes the quest.';
    dom.landingHowtoBody.textContent = `${story} ${discover}`;
  }
  hideLandingHowto();
  document.body.classList.add('landing-open');
  dom.threshold.hidden = false;
  dom.threshold.inert = false;
  dom.threshold.classList.add('is-open');
  startLandTalk();
  startLandWaves();
}

function hideLandingHowto() {
  if (!dom.landingHowto) return;
  dom.landingHowto.hidden = true;
}

function hideThreshold() {
  stopLandTalk();
  haltWaves();
  hideLandingHowto();
  document.body.classList.remove('landing-open');
  dom.threshold.classList.remove('is-open');
  dom.threshold.inert = true;
  setTimeout(() => { dom.threshold.hidden = true; }, 320);
}

async function enterFromLanding({ journeyMode }) {
  await Store.startSession(Store.intendedStation());
  Store.setIntendedStation(null);
  goVenueHome();
  hideThreshold();
  renderProgress();
  Store.setJourneyMode(journeyMode);
  openMapHome({ fit: journeyMode ? 'guardians' : 'park' });
}

function hideMapModal() {
  if (!dom.mapModal) return;
  mapModalMode = null;
  mapModalStation = null;
  dom.mapModal.classList.remove('is-open', 'mapModal--hint');
  dom.mapModal.inert = true;
  document.body.classList.remove('map-modal-open');
  setTimeout(() => {
    if (!dom.mapModal.classList.contains('is-open')) dom.mapModal.hidden = true;
  }, 280);
}

function showMapModal({ mode, eyebrow, title, body, primary, ghost, placement }) {
  mapModalMode = mode;
  dom.mapModalEyebrow.textContent = eyebrow;
  dom.mapModalTitle.textContent = title;
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
    body: 'These glowing seals are the five Guardians. Walk to any one, then tap its seal to meet them and play their challenge.',
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
  (Store.state.touchpoints || []).forEach((tp) => {
    if (tp.poiId && tp.element) realmByPoi[tp.poiId] = tp.element;
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

function renderLegend() {
  const counts = {};
  Store.state.pois.forEach((poi) => {
    counts[poi.category] = (counts[poi.category] || 0) + 1;
  });
  dom.legendRows.innerHTML = Object.entries(counts).map(([category, count]) => {
    const on = !Store.state.hiddenCategories.has(category);
    return `<button class="legend__row" data-category="${escapeHtml(category)}" aria-pressed="${on}" type="button">
      <span>${escapeHtml(category)}</span><span class="legend__count">${count}</span>
    </button>`;
  }).join('');
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
    const messages = {
      bad_code: 'That word isn’t right. Try again.',
      bad_images: 'Not those three — look again at the ice.',
      bad_sequence: 'Not that order. Watch once more.',
    };
    toast(messages[result.error] || 'Not quite — try again.');
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
      kicker: 'Realm Awakened',
      title: meta.label,
      meta: `${Store.realmsAwakened()} of 5 Realms`,
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

  if (!live) {
    if (slug && slug !== 'threshold') Store.setIntendedStation(slug);
    hideMapModal();
    showThreshold();
    const welcome = Store.touchByType('threshold')[0];
    renderStation(welcome?.slug || 'threshold');
    return;
  }

  hideThreshold();

  if (!slug || slug === 'threshold') {
    Store.setIntendedStation(null);
    openMapHome();
    return;
  }

  const station = Store.touchBySlug(slug);
  if (station?.type === 'guardian' && !station.complete) {
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
  dom.progressButton.addEventListener('click', () => openPanel('journey'));
  const toggleGuide = () => {
    if (mapModalMode === 'choice') return;
    if (document.body.classList.contains('guide-open')) closeGuide();
    else openGuide();
  };
  dom.guideToggle.addEventListener('click', toggleGuide);
  if (dom.headerMap) dom.headerMap.addEventListener('click', toggleGuide);

  dom.thresholdStart.addEventListener('click', () => enterFromLanding({ journeyMode: true }));
  dom.landingMap?.addEventListener('click', () => enterFromLanding({ journeyMode: false }));
  dom.landingHow?.addEventListener('click', () => {
    hideLandTalk();
    if (dom.landingHowto) dom.landingHowto.hidden = false;
  });
  dom.landingHowtoClose?.addEventListener('click', hideLandingHowto);
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
  dom.filterButton.addEventListener('click', () => {
    const showing = !dom.legend.hidden;
    dom.legend.hidden = showing;
    if (!showing) renderLegend();
  });
  dom.legendRows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    Store.toggleCategory(button.dataset.category);
    renderLegend();
    renderMap();
  });
  dom.scanFab.addEventListener('click', () => Scanner.open(handleCode));
  dom.awardDone.addEventListener('click', dismissAward);
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
      const id = image.dataset.imageId;
      if (selectedImages.has(id)) selectedImages.delete(id);
      else {
        if (selectedImages.size >= 3) selectedImages.clear();
        selectedImages.add(id);
      }
      image.closest('.pickGrid').querySelectorAll('[data-image-id]').forEach((btn) => {
        btn.classList.toggle('is-on', selectedImages.has(btn.dataset.imageId));
      });
      return;
    }
    if (event.target.closest('[data-image-submit]')) {
      const root = event.target.closest('[data-station]');
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
    if (event.target.closest('[data-quiz-submit]')) {
      const root = event.target.closest('[data-station]');
      handleStationChallenge(root.dataset.station, { done: true });
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id !== 'keepersForm') return;
    event.preventDefault();
    submitKeepers(event.target);
  });

  window.addEventListener('popstate', route);
  window.addEventListener('pagehide', stopStoryAudio);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (Scanner.isOpen()) Scanner.close();
    else if (!dom.award.hidden) dismissAward();
    else if (!dom.finale.hidden) hideFinale();
    else if (mapModalMode === 'choice') return;
    else if (mapModalMode === 'begin' || mapModalMode === 'beginGuide') hideMapModal();
    else if (currentPanel) closePanels();
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
    history.replaceState(null, '', Store.stationPath(Store.state.path.station));
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
