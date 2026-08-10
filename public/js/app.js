/* global window, document, Store, ParkMap, Scanner */

const GLYPHS = {
  crystal: '❄️', lantern: '🏮', flame: '🔥', wing: '🦋', rune: 'ᚦ',
  star: '✦', paw: '🐾', feather: '🪶', key: '🗝️', antler: '🦌',
  dragon: '🐉', bird: '🕊️', bear: '🐻‍❄️', horse: '🐴', tree: '🌲',
};
const glyph = (name) => GLYPHS[name] || GLYPHS.crystal;

const CATEGORY_LABELS = {
  landmark: 'Landmark', sculpture: 'Ice sculpture', lantern: 'Lantern display',
  'photo-op': 'Photo spot', ride: 'Ride', amenity: 'Facilities',
};
const categoryLabel = (key) => CATEGORY_LABELS[key] || key;

const el = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const dom = {
  parkName: el('parkName'), parkLocation: el('parkLocation'),
  progressFill: el('progressFill'), progressLabel: el('progressLabel'),
  progressButton: el('progressButton'),
  sheet: el('sheet'), sheetBody: el('sheetBody'), sheetGrip: el('sheetGrip'),
  huntPanel: el('huntPanel'), huntBody: el('huntBody'),
  passportPanel: el('passportPanel'), passportBody: el('passportBody'),
  toast: el('toast'), splash: el('bootSplash'),
  scanFab: el('scanFab'), recenter: el('recenterButton'),
  filterButton: el('filterButton'), legend: el('legend'), legendRows: el('legendRows'),
  journeyButton: el('journeyButton'),
  award: el('award'), awardGlyph: el('awardGlyph'), awardTitle: el('awardTitle'),
  awardMeta: el('awardMeta'), awardKicker: el('awardKicker'), awardPips: el('awardPips'),
  awardDone: el('awardDone'),
};

let currentPanel = null;
let awardQueue = [];
let awardShowing = false;

/* -------------------------------------------------------------------------- */
/* toast                                                                      */
/* -------------------------------------------------------------------------- */

let toastTimer = null;
function toast(message, { warm = false, ms = 3200 } = {}) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle('is-warm', warm);
  dom.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-on'), ms);
}

/* -------------------------------------------------------------------------- */
/* map rendering                                                              */
/* -------------------------------------------------------------------------- */

function targetPoiIds() {
  const earned = Store.tokenIds();
  const ids = new Set();
  Store.state.hunts.forEach((hunt) => {
    hunt.stops.forEach((stop) => {
      if (!earned.has(stop.id)) ids.add(stop.poiId);
    });
  });
  return ids;
}

function renderMap() {
  ParkMap.render(Store.state.pois, {
    scanned: Store.scannedIds(),
    targets: targetPoiIds(),
    hidden: Store.state.hiddenCategories,
    journeyOnly: Store.state.journeyMode,
    journeyIds: Store.journeyPoiIds(),
  });
  if (dom.journeyButton) {
    dom.journeyButton.classList.toggle('is-on', Store.state.journeyMode);
    dom.journeyButton.setAttribute('aria-pressed', String(Store.state.journeyMode));
    dom.journeyButton.setAttribute(
      'aria-label',
      Store.state.journeyMode ? 'Show full park map' : 'Show trail stops only'
    );
  }
}

function renderProgressRing() {
  const { tokens, tokensTotal } = Store.totals();
  const ratio = tokensTotal ? tokens / tokensTotal : 0;
  const circumference = 2 * Math.PI * 18;
  dom.progressFill.style.strokeDasharray = String(circumference);
  dom.progressFill.style.strokeDashoffset = String(circumference * (1 - ratio));
  dom.progressLabel.textContent = String(tokens);
  dom.progressButton.setAttribute(
    'aria-label',
    `Open your passport. ${tokens} of ${tokensTotal} lights collected.`
  );
}

/* -------------------------------------------------------------------------- */
/* POI sheet                                                                  */
/* -------------------------------------------------------------------------- */

function challengeFormHtml(stop) {
  const type = stop.challengeType || 'scan';
  const challenge = stop.challenge || {};
  if (type === 'scan') return '';

  if (type === 'acknowledge') {
    return `<div class="challenge" data-challenge-stop="${escapeHtml(stop.id)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt || 'Found it? Mark this stop complete.')}</p>
      <button class="textButton" data-challenge-ack type="button">I found it</button>
    </div>`;
  }
  if (type === 'reflection') {
    return `<div class="challenge" data-challenge-stop="${escapeHtml(stop.id)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt || 'What will you remember?')}</p>
      <textarea class="challenge__input" data-challenge-text rows="3" maxlength="400" placeholder="A sentence is enough"></textarea>
      <button class="textButton" data-challenge-submit type="button">Save &amp; collect</button>
    </div>`;
  }
  if (type === 'code_entry') {
    return `<div class="challenge" data-challenge-stop="${escapeHtml(stop.id)}">
      <p class="challenge__prompt">${escapeHtml(challenge.prompt || 'Enter the code at this stop.')}</p>
      <div class="challenge__row">
        <input class="challenge__input" data-challenge-code inputmode="latin" autocapitalize="characters"
               autocomplete="off" spellcheck="false" maxlength="24" placeholder="CODE">
        <button class="textButton" data-challenge-submit type="button">Go</button>
      </div>
    </div>`;
  }
  if (type === 'multiple_choice') {
    const choices = (challenge.choices || []).map((choice, index) =>
      `<button class="challenge__choice" data-challenge-choice="${index}" type="button">${escapeHtml(choice)}</button>`
    ).join('');
    return `<div class="challenge" data-challenge-stop="${escapeHtml(stop.id)}">
      <p class="challenge__prompt">${escapeHtml(challenge.question || 'Choose the right answer.')}</p>
      <div class="challenge__choices">${choices}</div>
    </div>`;
  }
  return '';
}

function openSheet(poi) {
  const scanned = Store.scannedIds().has(poi.id);
  const stops = Store.stopsForPoi(poi.id);
  const earned = Store.tokenIds();

  const chips = [];
  if (poi.zone) chips.push(`<span class="chip">${escapeHtml(poi.zone)}</span>`);
  stops.forEach((stop) => {
    const has = earned.has(stop.id);
    chips.push(
      `<span class="chip ${has ? 'chip--found' : 'chip--target'}">${glyph(stop.token_glyph || stop.tokenGlyph)} ${escapeHtml(stop.tokenName)}${has ? '' : ' — not yet'}</span>`
    );
  });

  const pendingChallenges = stops
    .filter((stop) => !earned.has(stop.id) && stop.challengeType && stop.challengeType !== 'scan')
    .map(challengeFormHtml)
    .join('');

  const needsScan = stops.some((stop) => !earned.has(stop.id) && (!stop.challengeType || stop.challengeType === 'scan'));

  const detail = scanned || !stops.length
    ? `${poi.description ? `<p class="poi__body">${escapeHtml(poi.description)}</p>` : ''}
       ${poi.funFact ? `<div class="poi__fact"><strong>Did you know</strong>${escapeHtml(poi.funFact)}</div>` : ''}`
    : `${needsScan ? `<div class="poi__fact"><strong>There's a code here</strong>Find the sign at this stop and scan it to collect ${escapeHtml(stops.filter((s) => !s.challengeType || s.challengeType === 'scan').map((s) => s.tokenName).join(' and ') || 'this light')}.</div>` : ''}
       ${poi.description ? `<p class="poi__body">${escapeHtml(poi.description)}</p>` : ''}`;

  dom.sheetBody.innerHTML = `
    <div style="--pin-color: ${ParkMap.colorFor(poi.category)}">
      <p class="poi__eyebrow"><span class="dot"></span>${escapeHtml(categoryLabel(poi.category))}${scanned ? ' · visited' : ''}</p>
      <h2 class="poi__name">${escapeHtml(poi.name)}</h2>
      ${poi.blurb ? `<p class="poi__blurb">${escapeHtml(poi.blurb)}</p>` : ''}
      ${poi.imageUrl ? `<img class="poi__img" src="${escapeHtml(poi.imageUrl)}" alt="${escapeHtml(poi.name)}">` : ''}
      ${chips.length ? `<div class="chipRow">${chips.join('')}</div>` : ''}
      ${detail}
      ${pendingChallenges}
    </div>`;

  document.body.classList.add('sheet-open');
  ParkMap.focusOn(poi.id, Store.state.pois);
}

function closeSheet() {
  document.body.classList.remove('sheet-open');
  ParkMap.highlight(null);
  if (location.hash.startsWith('#/poi/')) history.replaceState(null, '', '#/map');
}

/* -------------------------------------------------------------------------- */
/* trails panel                                                               */
/* -------------------------------------------------------------------------- */

function renderHunts() {
  const hunts = Store.state.hunts;

  if (!hunts.length) {
    dom.huntBody.innerHTML = `
      <div class="empty">
        <p class="empty__mark">✦</p>
        <h3 class="empty__title">No trails running tonight</h3>
        <p class="empty__body">Check back on your next visit — new trails open through the season.</p>
      </div>`;
    return;
  }

  const earned = Store.tokenIds();

  dom.huntBody.innerHTML = hunts.map((hunt) => {
    const { found, total, done, redeemCode } = Store.huntProgress(hunt);
    const pct = total ? Math.round((found / total) * 100) : 0;

    const stops = hunt.stops.map((stop) => {
      const has = earned.has(stop.id);
      const type = stop.challengeType || 'scan';
      const typeNote = !has && type !== 'scan'
        ? `<p class="stop__zone">${type === 'multiple_choice' ? 'Answer on the map' : type === 'code_entry' ? 'Enter a code' : type === 'reflection' ? 'Leave a note' : 'Tap to complete'}</p>`
        : '';
      return `
        <li>
          <button class="stop ${has ? 'is-found' : 'is-secret'}" data-focus-poi="${escapeHtml(stop.poiId)}" type="button">
            <span class="stop__token" style="font-size:19px">${has ? glyph(stop.tokenGlyph) : '◇'}</span>
            <span style="min-width:0">
              <p class="stop__name">${has ? escapeHtml(stop.tokenName) : 'Not found yet'}</p>
              ${stop.hint ? `<p class="stop__hint">${escapeHtml(stop.hint)}</p>` : ''}
              ${has ? `<p class="stop__zone">${escapeHtml(stop.poiName)}</p>` : typeNote}
            </span>
          </button>
        </li>`;
    }).join('');

    const reward = done
      ? `<div class="reward">
           <p class="reward__title">${escapeHtml(hunt.rewardTitle || 'Reward unlocked')}</p>
           <p class="reward__body">${escapeHtml(hunt.rewardBody || '')}</p>
           ${redeemCode ? `<span class="reward__code">${escapeHtml(redeemCode)}</span>` : ''}
         </div>`
      : `<div class="reward reward--locked">
           <p class="reward__title">🔒 ${escapeHtml(hunt.rewardTitle || 'Reward')}</p>
           <p class="reward__body">${total - found} more to go. Keep exploring.</p>
         </div>`;

    return `
      <article class="hunt ${done ? 'is-complete' : ''}">
        <p class="hunt__title">${escapeHtml(hunt.title)}</p>
        ${hunt.tagline ? `<h3 class="hunt__tagline">${escapeHtml(hunt.tagline)}</h3>` : ''}
        ${hunt.description ? `<p class="hunt__desc">${escapeHtml(hunt.description)}</p>` : ''}
        <div class="tally">
          <span class="tally__bar"><span class="tally__fill" style="width:${pct}%"></span></span>
          <span class="tally__count">${found}/${total}</span>
        </div>
        <ul class="stopList">${stops}</ul>
        ${reward}
      </article>`;
  }).join('');
}

/* -------------------------------------------------------------------------- */
/* passport panel                                                              */
/* -------------------------------------------------------------------------- */

function renderPassport() {
  const totals = Store.totals();
  const earned = Store.tokenIds();
  const allStops = Store.state.hunts.flatMap((h) => h.stops.map((s) => ({ ...s, hunt: h })));

  const tokens = allStops.length
    ? `<p class="sectionLabel">Lights collected</p>
       <div class="tokenGrid">
         ${allStops.map((stop) => {
           const has = earned.has(stop.id);
           return `<div class="token ${has ? 'is-earned' : ''}">
             <span class="token__glyph">${has ? glyph(stop.tokenGlyph) : '◇'}</span>
             <span class="token__name">${has ? escapeHtml(stop.tokenName) : 'Locked'}</span>
           </div>`;
         }).join('')}
       </div>`
    : '';

  const visited = Store.state.progress.scans
    .map((scan) => Store.poiById(scan.poiId))
    .filter(Boolean);

  const visitedList = visited.length
    ? `<p class="sectionLabel">Places you’ve reached</p>
       <ul class="stopList" style="margin-bottom:24px">
         ${visited.map((poi) => `
           <li><button class="stop is-found" data-focus-poi="${escapeHtml(poi.id)}" type="button">
             <span class="stop__token" style="font-size:17px">📍</span>
             <span><p class="stop__name">${escapeHtml(poi.name)}</p>
             ${poi.zone ? `<p class="stop__zone">${escapeHtml(poi.zone)}</p>` : ''}</span>
           </button></li>`).join('')}
       </ul>`
    : `<div class="empty">
         <p class="empty__mark">❄︎</p>
         <h3 class="empty__title">Your passport is empty</h3>
         <p class="empty__body">Find a code on the trail and scan it. Everything you collect shows up here, and it stays here on your next visit.</p>
         <button class="textButton" data-open-scanner type="button">Scan your first code</button>
       </div>`;

  const rewards = Store.state.progress.completions.map((completion) => {
    const hunt = Store.state.hunts.find((h) => h.id === completion.huntId);
    if (!hunt) return '';
    return `<div class="reward" style="margin-bottom:12px">
      <p class="reward__title">${escapeHtml(hunt.rewardTitle || hunt.title)}</p>
      <p class="reward__body">${escapeHtml(hunt.rewardBody || '')}</p>
      ${completion.redeemCode ? `<span class="reward__code">${escapeHtml(completion.redeemCode)}</span>` : ''}
    </div>`;
  }).join('');

  dom.passportBody.innerHTML = `
    <div class="statRow">
      <div class="stat"><span class="stat__n">${totals.tokens}</span><span class="stat__l">Lights</span></div>
      <div class="stat"><span class="stat__n">${totals.visited}</span><span class="stat__l">Places</span></div>
      <div class="stat"><span class="stat__n">${totals.rewards}</span><span class="stat__l">Rewards</span></div>
    </div>
    ${rewards ? `<p class="sectionLabel">Ready to redeem</p>${rewards}` : ''}
    ${tokens}
    ${visitedList}
    <p class="sectionLabel" style="margin-top:8px">About your progress</p>
    <p class="fineprint">
      Progress is saved to this browser on this phone — no account, no email, nothing personal.
      It will still be here on your next visit as long as you don't clear your browser data.
      <button class="textButton" style="margin-top:12px;font-size:13px;padding:9px 16px" data-reset-guest type="button">Start over</button>
    </p>`;
}

/* -------------------------------------------------------------------------- */
/* info panel (reuses the sheet)                                              */
/* -------------------------------------------------------------------------- */

function openInfo() {
  const park = Store.state.park || {};
  const queued = Store.queue().length;
  dom.sheetBody.innerHTML = `
    <div style="--pin-color: var(--aurora)">
      <p class="poi__eyebrow"><span class="dot"></span>Visiting</p>
      <h2 class="poi__name">${escapeHtml(park.welcomeHeadline || 'Welcome')}</h2>
      <p class="poi__body">${escapeHtml(park.welcomeBody || '')}</p>
      ${park.hoursNote ? `<div class="poi__fact"><strong>Hours</strong>${escapeHtml(park.hoursNote)}</div>` : ''}
      ${park.safetyNote ? `<div class="poi__fact"><strong>Stay safe</strong>${escapeHtml(park.safetyNote)}</div>` : ''}
      ${queued ? `<p class="fineprint">${queued} scan${queued === 1 ? '' : 's'} saved while you were offline. They’ll be added as soon as you have signal.</p>` : ''}
      <p class="fineprint" style="margin-top:14px">
        ${Store.state.online ? 'Connected.' : 'You’re offline — the map still works, and scans are saved until you’re back in range.'}
      </p>
    </div>`;
  document.body.classList.add('sheet-open');
}

/* -------------------------------------------------------------------------- */
/* panels                                                                     */
/* -------------------------------------------------------------------------- */

function openPanel(name) {
  closeSheet();
  ['huntPanel', 'passportPanel'].forEach((key) => {
    dom[key].hidden = true;
    dom[key].classList.remove('is-open');
  });

  if (name === 'hunt') { renderHunts(); showPanel(dom.huntPanel); }
  else if (name === 'passport') { renderPassport(); showPanel(dom.passportPanel); }
  currentPanel = name;
  document.body.classList.add('panel-open');
  setActiveNav(name);
}

function showPanel(panel) {
  panel.hidden = false;
  requestAnimationFrame(() => panel.classList.add('is-open'));
  panel.querySelector('.panel__scroll').scrollTop = 0;
}

function closePanels() {
  ['huntPanel', 'passportPanel'].forEach((key) => {
    dom[key].classList.remove('is-open');
    setTimeout(() => { dom[key].hidden = true; }, 440);
  });
  currentPanel = null;
  document.body.classList.remove('panel-open');
  setActiveNav('map');
  if (location.hash !== '#/map') history.replaceState(null, '', '#/map');
}

function setActiveNav(view) {
  document.querySelectorAll('.nav__item').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });
}

/* -------------------------------------------------------------------------- */
/* the earn moment                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Awards are queued and shown one at a time. A single scan can complete a stop
 * and finish a whole hunt, and stacking those two moments on top of each other
 * would waste the payoff.
 */
function enqueueAward(award) {
  awardQueue.push(award);
  if (!awardShowing) showNextAward();
}

function showNextAward() {
  const next = awardQueue.shift();
  if (!next) {
    awardShowing = false;
    return;
  }
  awardShowing = true;

  dom.award.classList.toggle('is-final', Boolean(next.final));
  dom.awardGlyph.textContent = next.glyph;
  dom.awardKicker.textContent = next.kicker;
  dom.awardTitle.textContent = next.title;
  dom.awardMeta.textContent = next.meta;
  dom.awardDone.textContent = next.action || 'Keep exploring';

  dom.awardPips.innerHTML = next.total
    ? Array.from({ length: next.total }, (_, i) =>
        `<span class="award__pip ${i < next.earned ? 'is-on' : ''}"></span>`).join('')
    : '';

  dom.award.hidden = false;
  requestAnimationFrame(() => dom.award.classList.add('is-open'));
  if (navigator.vibrate) navigator.vibrate(next.final ? [40, 60, 120] : 45);
}

function dismissAward() {
  dom.award.classList.remove('is-open');
  setTimeout(() => {
    dom.award.hidden = true;
    showNextAward();
  }, 340);
}

/* -------------------------------------------------------------------------- */
/* scanning                                                                   */
/* -------------------------------------------------------------------------- */

async function handleCode(code) {
  const result = await Store.scan(code);

  if (result.status === 'unknown') {
    toast('That code isn’t one of ours. Check the letters and try again.');
    return;
  }
  if (result.status === 'invalid') {
    toast('Enter the code printed under the sign.');
    return;
  }
  if (result.status === 'queued') {
    Scanner.close();
    toast('Saved. We’ll add it as soon as you have signal.', { warm: true });
    return;
  }

  Scanner.close();
  renderMap();
  renderProgressRing();
  if (currentPanel) openPanel(currentPanel);

  if (result.status === 'repeat') {
    toast(`You’ve already collected ${result.poi.name}.`);
    showPoiBySlug(result.poi.slug);
    return;
  }

  presentScanResult(result);
}

function presentScanResult(result) {
  const { poi, awards = [], completed = [] } = result;
  if (poi?.id) ParkMap.celebrate(poi.id);

  awards.forEach((award) => {
    enqueueAward({
      glyph: glyph(award.tokenGlyph),
      kicker: 'Light collected',
      title: award.tokenName,
      meta: `${award.earnedCount} of ${award.totalCount} on ${award.huntTitle}`,
      earned: award.earnedCount,
      total: award.totalCount,
      action: award.earnedCount >= award.totalCount ? 'See your reward' : 'Keep exploring',
    });
  });

  completed.forEach((completion) => {
    enqueueAward({
      glyph: '🏆',
      kicker: 'Trail complete',
      title: completion.rewardTitle || 'Reward unlocked',
      meta: completion.rewardBody || '',
      action: 'Show me',
      final: true,
      onDone: () => openPanel('hunt'),
    });
  });

  if (!awards.length && !completed.length && poi) {
    toast(`Found ${poi.name}.`, { warm: true });
  }
  if (poi?.slug) showPoiBySlug(poi.slug, { silent: Boolean(awards.length || completed.length) });
}

async function handleChallenge(stopId, answer) {
  const result = await Store.completeChallenge(stopId, answer);
  if (result.status === 'error') {
    const messages = {
      bad_code: 'That code isn’t right. Try again.',
      bad_choice: 'Not quite — try another answer.',
      empty_reflection: 'Write a short note first.',
      requires_scan: 'This stop needs a QR scan.',
    };
    toast(messages[result.error] || 'Couldn’t complete that stop.');
    return;
  }

  renderMap();
  renderProgressRing();
  if (currentPanel) openPanel(currentPanel);

  if (result.status === 'repeat') {
    toast('You’ve already collected this one.');
    if (result.poi) showPoiBySlug(result.poi.slug);
    return;
  }

  presentScanResult(result);
}

/* -------------------------------------------------------------------------- */
/* routing                                                                    */
/* -------------------------------------------------------------------------- */

function showPoiBySlug(slug, { silent = false } = {}) {
  const poi = Store.poiBySlug(slug);
  if (!poi) return;
  if (!silent) openSheet(poi);
  else {
    // Prepare the sheet behind the award overlay so it's already there.
    openSheet(poi);
  }
}

function route() {
  const hash = location.hash || '#/map';
  const [, section, param] = hash.split('/');

  if (section === 'poi' && param) {
    closePanels();
    const poi = Store.poiBySlug(param);
    if (poi) openSheet(poi);
    return;
  }
  if (section === 'scan' && param) {
    history.replaceState(null, '', '#/map');
    handleCode(param);
    return;
  }
  if (section === 'trails') { openPanel('hunt'); return; }
  if (section === 'passport') { openPanel('passport'); return; }
  if (section === 'info') { closePanels(); openInfo(); return; }

  closePanels();
  closeSheet();
}

/* -------------------------------------------------------------------------- */
/* legend / filters                                                           */
/* -------------------------------------------------------------------------- */

function renderLegend() {
  const counts = {};
  Store.state.pois.forEach((poi) => {
    counts[poi.category] = (counts[poi.category] || 0) + 1;
  });

  dom.legendRows.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => {
      const on = !Store.state.hiddenCategories.has(category);
      return `<button class="legend__row" data-category="${escapeHtml(category)}"
                aria-pressed="${on}" type="button" style="--pin-color:${ParkMap.colorFor(category)}">
                <span class="legend__gem"></span>
                <span>${escapeHtml(categoryLabel(category))}</span>
                <span class="legend__count">${count}</span>
              </button>`;
    }).join('');
}

/* -------------------------------------------------------------------------- */
/* wiring                                                                     */
/* -------------------------------------------------------------------------- */

function wire() {
  dom.scanFab.addEventListener('click', () => {
    closePanels();
    Scanner.open(handleCode);
  });

  dom.sheetGrip.addEventListener('click', closeSheet);

  dom.recenter.addEventListener('click', () => {
    ParkMap.fit();
    toast('Whole park in view');
  });

  if (dom.journeyButton) {
    dom.journeyButton.addEventListener('click', () => {
      const on = Store.toggleJourneyMode();
      renderMap();
      toast(on ? 'Trail mode — only stop markers' : 'Full park map');
    });
  }

  dom.filterButton.addEventListener('click', () => {
    const showing = !dom.legend.hidden;
    dom.legend.hidden = showing;
    dom.filterButton.classList.toggle('is-on', !showing);
    if (!showing) renderLegend();
  });

  dom.legendRows.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    Store.toggleCategory(button.dataset.category);
    renderLegend();
    renderMap();
  });

  dom.progressButton.addEventListener('click', () => { location.hash = '#/passport'; });

  document.querySelectorAll('.nav__item').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      location.hash = view === 'map' ? '#/map'
        : view === 'hunt' ? '#/trails'
        : view === 'passport' ? '#/passport'
        : '#/info';
      if (view === 'map') { closePanels(); closeSheet(); }
    });
  });

  document.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', () => { location.hash = '#/map'; });
  });

  dom.awardDone.addEventListener('click', dismissAward);
  dom.award.addEventListener('click', (event) => {
    if (event.target === dom.award) dismissAward();
  });

  // Delegated actions that appear inside rendered panels.
  document.addEventListener('click', (event) => {
    const focus = event.target.closest('[data-focus-poi]');
    if (focus) {
      const poi = Store.poiById(focus.dataset.focusPoi);
      if (poi) { location.hash = `#/poi/${poi.slug}`; }
      return;
    }
    if (event.target.closest('[data-open-scanner]')) {
      closePanels();
      Scanner.open(handleCode);
      return;
    }
    if (event.target.closest('[data-reset-guest]')) {
      if (confirm('Clear everything you have collected and start fresh?')) {
        Store.resetGuest().then(() => {
          renderMap();
          renderProgressRing();
          renderPassport();
          toast('Passport cleared.');
        });
      }
      return;
    }

    const challengeRoot = event.target.closest('[data-challenge-stop]');
    if (!challengeRoot) return;
    const stopId = challengeRoot.dataset.challengeStop;

    if (event.target.closest('[data-challenge-ack]')) {
      handleChallenge(stopId, {});
      return;
    }
    if (event.target.closest('[data-challenge-choice]')) {
      const choice = event.target.closest('[data-challenge-choice]');
      handleChallenge(stopId, { choiceIndex: Number(choice.dataset.challengeChoice) });
      return;
    }
    if (event.target.closest('[data-challenge-submit]')) {
      const text = challengeRoot.querySelector('[data-challenge-text]')?.value;
      const code = challengeRoot.querySelector('[data-challenge-code]')?.value;
      if (text !== undefined) handleChallenge(stopId, { text });
      else handleChallenge(stopId, { code });
    }
  });

  window.addEventListener('hashchange', route);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (Scanner.isOpen()) Scanner.close();
    else if (!dom.award.hidden) dismissAward();
    else if (currentPanel) location.hash = '#/map';
    else closeSheet();
  });

  // Coming back to a backgrounded tab: re-sync and drain anything queued.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    ParkMap.invalidate();
    Store.refreshProgress().then(afterSync);
  });

  window.addEventListener('online', () => {
    toast('Back online. Catching up…');
    Store.flushQueue().then((results) => {
      results.forEach(presentScanResult);
      afterSync();
    });
  });
}

function afterSync() {
  renderMap();
  renderProgressRing();
  if (currentPanel) openPanel(currentPanel);
}

/* -------------------------------------------------------------------------- */
/* boot                                                                       */
/* -------------------------------------------------------------------------- */

async function boot() {
  wire();

  try {
    await Store.load();
  } catch {
    dom.splash.innerHTML = `
      <div class="empty">
        <p class="empty__mark">❄︎</p>
        <h3 class="empty__title">Can’t reach the park guide</h3>
        <p class="empty__body">Check your connection and pull down to reload. If you’re inside the park, ask at the Warming Hut.</p>
      </div>`;
    return;
  }

  const park = Store.state.park || {};
  const adventure = Store.state.adventure || {};
  dom.parkName.textContent = park.name || 'Ice Castles';
  dom.parkLocation.textContent = park.locationName
    || (adventure.year ? `${adventure.year} adventure` : '');
  document.title = `${park.name || 'Ice Castles'} — Park Guide`;

  ParkMap.init(document.getElementById('map'), Store.state.map, {
    onSelect: (poiId) => {
      if (!poiId) { closeSheet(); return; }
      const poi = Store.poiById(poiId);
      if (poi) location.hash = `#/poi/${poi.slug}`;
    },
  });

  renderMap();
  renderProgressRing();
  renderLegend();

  dom.splash.classList.add('is-gone');
  setTimeout(() => { dom.splash.hidden = true; }, 520);

  if (Store.state.loadedFromCache) {
    toast('Showing the map you loaded last time. Scans are saved until you’re back online.');
  }

  route();
  Store.flushQueue().then((results) => {
    results.forEach(presentScanResult);
    if (results.length) afterSync();
  });

  Store.subscribe(() => {
    renderProgressRing();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

boot();
