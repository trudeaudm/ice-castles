/* global window, document, Store, ParkMap, Scanner */

const REALM_META = {
  water: { label: 'Water', glyph: '💧' },
  earth: { label: 'Earth', glyph: '🪨' },
  fire: { label: 'Fire', glyph: '🔥' },
  air: { label: 'Air', glyph: '🌬️' },
  spirit: { label: 'Spirit', glyph: '✦' },
};

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
  threshold: el('threshold'), thresholdEyebrow: el('thresholdEyebrow'),
  thresholdTitle: el('thresholdTitle'), thresholdSubtitle: el('thresholdSubtitle'),
  thresholdBody: el('thresholdBody'), thresholdStart: el('thresholdStart'),
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

const ICON_HANDSHAKE = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M12 30c3-8 10-12 18-10l4 2"/>
  <path d="M52 30c-3-8-10-12-18-10l-4 2"/>
  <path d="M16 32c4 1 7 6 8 10 2-5 6-8 11-8s9 3 11 8c1-4 4-9 8-10"/>
  <path d="M22 42c3 6 8 9 10 9s7-3 10-9"/>
  <path d="M20 28l6 3M44 28l-6 3"/>
</svg>`;
const ICON_COMPASS = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="20"/>
  <circle cx="32" cy="32" r="3"/>
  <path d="M32 12v6M32 46v6M12 32h6M46 32h6"/>
  <path d="M32 18l7 18-7-3-7 3z"/>
  <path d="M32 46l-4-12 4 2 4-2z"/>
</svg>`;
const ICON_PLAY = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="22"/>
  <path d="M27 20l20 12-20 12z" fill="currentColor" stroke="none"/>
</svg>`;

function setShrineFocus(key, { spin = true } = {}) {
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
  route();
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
  dom.realmPips.innerHTML = ['water', 'earth', 'fire', 'air', 'spirit'].map((realm) => {
    const on = realms.some((r) => r.realm === realm && r.complete);
    return `<span class="realmPip realmPip--${realm} ${on ? 'is-on' : ''}" title="${REALM_META[realm].label}">${REALM_META[realm].glyph}</span>`;
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
      <div class="challenge__row">
        <input class="challenge__input" data-challenge-code inputmode="latin" autocapitalize="characters"
               autocomplete="off" spellcheck="false" maxlength="24" placeholder="WORD">
        <button class="textButton textButton--play" data-challenge-submit type="button">Go</button>
      </div>
    </div>`;
  }

  if (type === 'image_select') {
    const tiles = (challenge.images || []).map((img) =>
      `<button class="pickTile" data-image-id="${escapeHtml(img.id)}" type="button" style="--tile:${escapeHtml(img.color || '#5df0cf')}">
        ${img.url ? `<img src="${escapeHtml(img.url)}" alt="">` : ''}
        <span>${escapeHtml(img.label || img.id)}</span>
      </button>`
    ).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      <div class="pickGrid">${tiles}</div>
      <button class="textButton textButton--play" data-image-submit type="button">Check my three</button>
    </div>`;
  }

  if (type === 'sequence' || type === 'multi_sequence') {
    const opts = (challenge.options || []).map((opt) => {
      const id = opt.id || opt;
      const label = opt.label || opt;
      const color = opt.color || '';
      return `<button class="seqBtn" data-seq="${escapeHtml(id)}" type="button" style="${color ? `--tile:${escapeHtml(color)}` : ''}">${escapeHtml(label)}</button>`;
    }).join('');
    return `<div class="challenge" data-station="${escapeHtml(station.slug)}" data-seq-len="${challenge.length || 5}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt)}</p>
      <p class="seqReadout" data-seq-readout>Tap the sequence</p>
      <div class="seqRow">${opts}</div>
      <button class="textButton" data-seq-clear type="button">Clear</button>
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

function renderStation(slug) {
  const station = Store.touchBySlug(slug) || Store.touchByType('threshold')[0];
  if (!station) {
    dom.stationView.innerHTML = `<div class="empty"><p class="empty__title">This station isn’t on tonight’s quest.</p></div>`;
    return;
  }

  if (shrineSlug !== station.slug) {
    shrineSlug = station.slug;
    shrineFocus = null;
  }

  const gated = station.type === 'guardian' || station.type === 'monument';
  const playHtml = station.challengeType ? challengeHtml(station) : '';
  const extra = station.type === 'monument' && Store.state.session?.builderQuizAt
    ? `<p class="fineprint">You finished the builder quiz. This stop is optional.</p>`
    : '';

  if (!gated) {
    dom.stationView.innerHTML = `
      <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
        <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
        <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
        ${station.imageUrl ? `<img class="shrine__art" src="${escapeHtml(station.imageUrl)}" alt="">` : ''}
        <section class="shrine__block">
          <h3>${escapeHtml(shrineMeetTitle(station))}</h3>
          <p>${escapeHtml(station.body || '')}</p>
        </section>
        ${station.discoverBody ? `<section class="shrine__block">
          <h3>Discover</h3>
          <p>${escapeHtml(station.discoverBody)}</p>
        </section>` : ''}
        <div id="heartSlot"></div>
      </article>`;
    if (station.type === 'heart') renderHeartSlot();
    return;
  }

  dom.stationView.innerHTML = `
    <article class="shrine" data-realm="${escapeHtml(station.element || '')}">
      <p class="shrine__kicker">${escapeHtml(station.subtitle || station.type)}</p>
      <h2 class="shrine__title">${escapeHtml(station.title)}</h2>
      ${station.element ? `<p class="chip chip--target">${escapeHtml(REALM_META[station.element]?.label || station.element)}</p>` : ''}
      ${station.imageUrl ? `<img class="shrine__art shrine__art--small" src="${escapeHtml(station.imageUrl)}" alt="">` : ''}
      <div class="shrineGate" data-focus="">
        <button class="shrineIcon" data-shrine-focus="meet" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_HANDSHAKE}</span>
          <span class="shrineIcon__label">Meet</span>
        </button>
        <button class="shrineIcon" data-shrine-focus="discover" type="button">
          <span class="shrineIcon__orbit" aria-hidden="true"></span>
          <span class="shrineIcon__gem">${ICON_COMPASS}</span>
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
        <p>${escapeHtml(station.body || '')}</p>
        ${station.audioUrl ? `<audio class="journeyAudio" controls preload="none" src="${escapeHtml(station.audioUrl)}"></audio>` : ''}
      </section>
      <section class="shrinePanel" data-panel="discover">
        <h3>Discover</h3>
        <p>${escapeHtml(station.discoverBody || 'Look around this shrine. The castle keeps its own clues.')}</p>
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
}

async function openStation(slug, { recordVisit = true } = {}) {
  hideThreshold();
  closePanels();
  closeGuide();
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
    slot.innerHTML = `<div class="challenge">
      <p class="challenge__prompt">The Heart is still sleeping. ${names.length === 1 ? 'This Realm' : 'These Realms'} remain: <strong>${escapeHtml(names.join(', '))}</strong>.</p>
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
    <div class="seal__ring" aria-hidden="true"></div>
    <p class="seal__kicker">Winter Keeper Seal</p>
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
        <span class="stop__token">${tp.type === 'heart' ? '❤' : tp.type === 'monument' ? '▣' : tp.complete ? '✦' : '◇'}</span>
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

function showThreshold() {
  const tp = Store.touchByType('threshold')[0];
  const park = Store.state.park || {};
  dom.thresholdEyebrow.textContent = 'Winter’s Keeper';
  dom.thresholdTitle.textContent = tp?.title || 'The Threshold';
  dom.thresholdSubtitle.textContent = tp?.subtitle || 'Castle Quest';
  dom.thresholdBody.textContent = tp?.body || park.welcomeBody ||
    'Explore the castle, complete five Guardian challenges in any order, then scan The Heart.';
  dom.threshold.hidden = false;
  dom.threshold.inert = false;
  requestAnimationFrame(() => dom.threshold.classList.add('is-open'));
}

function hideThreshold() {
  dom.threshold.classList.remove('is-open');
  dom.threshold.inert = true;
  setTimeout(() => { dom.threshold.hidden = true; }, 320);
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

function closeGuide() {
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
      if (!poiId) { document.body.classList.remove('sheet-open'); return; }
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
  ParkMap.render(Store.state.pois, {
    scanned: Store.scannedIds(),
    targets: Store.journeyPoiIds(),
    hidden: Store.state.hiddenCategories,
    journeyOnly: Store.state.journeyMode,
    journeyIds: Store.journeyPoiIds(),
  });
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
  dom.awardGlyph.textContent = next.glyph;
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
  if (result.realmAwakened) {
    const meta = REALM_META[result.realmAwakened] || { label: result.realmAwakened, glyph: '✦' };
    enqueueAward({
      glyph: meta.glyph,
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
    showThreshold();
    const welcome = Store.touchByType('threshold')[0];
    renderStation(welcome?.slug || 'threshold');
    return;
  }

  hideThreshold();
  const target = slug || Store.intendedStation() || Store.touchByType('threshold')[0]?.slug;
  if (target) await openStation(target);
}

/* -------------------------------------------------------------------------- */
/* wiring                                                                     */
/* -------------------------------------------------------------------------- */

function wire() {
  dom.progressButton.addEventListener('click', () => openPanel('journey'));
  const toggleGuide = () => {
    if (document.body.classList.contains('guide-open')) closeGuide();
    else openGuide();
  };
  dom.guideToggle.addEventListener('click', toggleGuide);
  if (dom.headerMap) dom.headerMap.addEventListener('click', toggleGuide);

  dom.thresholdStart.addEventListener('click', async () => {
    const intended = Store.intendedStation();
    await Store.startSession(intended);
    hideThreshold();
    renderProgress();
    const next = intended && intended !== 'threshold' ? intended : Store.touchByType('guardian')[0]?.slug;
    if (next) goStation(next);
    else route();
  });

  dom.sheetGrip.addEventListener('click', () => document.body.classList.remove('sheet-open'));
  dom.recenter.addEventListener('click', () => { ParkMap.fit(); toast('Whole park in view'); });
  dom.journeyButton.addEventListener('click', () => {
    const on = Store.toggleJourneyMode();
    renderMap();
    toast(on ? 'Quest stops only' : 'Full park map');
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
      sequenceBuffer.push(seq.dataset.seq);
      root.querySelector('[data-seq-readout]').textContent = sequenceBuffer
        .map((id) => (REALM_META[id]?.label || id)).join(' → ');
      if (sequenceBuffer.length >= len) {
        const answer = { sequence: [...sequenceBuffer] };
        sequenceBuffer = [];
        handleStationChallenge(root.dataset.station, answer);
      }
      return;
    }
    if (event.target.closest('[data-seq-clear]')) {
      sequenceBuffer = [];
      const readout = event.target.closest('.challenge')?.querySelector('[data-seq-readout]');
      if (readout) readout.textContent = 'Tap the sequence';
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
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (Scanner.isOpen()) Scanner.close();
    else if (!dom.award.hidden) dismissAward();
    else if (!dom.finale.hidden) hideFinale();
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
