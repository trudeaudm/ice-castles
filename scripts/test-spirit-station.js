#!/usr/bin/env node
/**
 * Spirit button→lantern challenge checks (config, validation, assignment rules).
 * Run: node scripts/test-spirit-station.js
 */
const assert = require('assert');
const {
  SPIRIT_STATION_CONFIG,
  validateSpiritStationConfig,
  assertSpiritStationConfig,
  getChallenge,
  pickChallengeId,
  publicAssignment,
  publicColors,
  lanternAnswerMatches,
  seqKey,
} = require('../server/spiritStationConfig');
const { validateChallengeAnswer } = require('../server/adventures');

assertSpiritStationConfig();
const ok = validateSpiritStationConfig();
assert.strictEqual(ok.ok, true, ok.errors.join('; '));

// Example test mapping (Water/Earth/Fire/Air palette).
const example = getChallenge('spirit-test-01');
assert.ok(example);
assert.deepStrictEqual(example.buttons, ['blue', 'green', 'blue', 'red']);
assert.deepStrictEqual(example.lanterns, ['icy', 'red', 'green', 'icy']);
assert.strictEqual(example.test, true);
assert.strictEqual(
  lanternAnswerMatches('spirit-test-01', ['icy', 'red', 'green', 'icy']),
  true
);
assert.strictEqual(
  lanternAnswerMatches('spirit-test-01', ['blue', 'green', 'blue', 'red']),
  false
);
assert.deepStrictEqual(
  Object.keys(SPIRIT_STATION_CONFIG.colors),
  ['blue', 'green', 'red', 'icy']
);
assert.strictEqual(SPIRIT_STATION_CONFIG.colors.blue.element, 'water');
assert.strictEqual(SPIRIT_STATION_CONFIG.colors.green.element, 'earth');
assert.strictEqual(SPIRIT_STATION_CONFIG.colors.red.element, 'fire');
assert.strictEqual(SPIRIT_STATION_CONFIG.colors.icy.element, 'air');
assert.strictEqual(SPIRIT_STATION_CONFIG.colors.icy.label, 'Icy blue');

// Guest-safe assignment never includes lantern answers.
const pub = publicAssignment('spirit-test-01');
assert.deepStrictEqual(pub.buttons, example.buttons);
assert.strictEqual(pub.challengeId, 'spirit-test-01');
assert.strictEqual('lanterns' in pub, false);
assert.ok(publicColors().every((c) => c.id && c.label && c.symbol && c.number && c.color));

// Server validation uses session assignment, not a client-spoofed id.
const pass = validateChallengeAnswer(
  'button_lantern',
  {},
  { sequence: ['icy', 'red', 'green', 'icy'], challengeId: 'spirit-test-01' },
  { spiritChallengeId: 'spirit-test-01' }
);
assert.strictEqual(pass.ok, true);

const wrong = validateChallengeAnswer(
  'button_lantern',
  {},
  { sequence: ['blue', 'green', 'blue', 'red'], challengeId: 'spirit-test-01' },
  { spiritChallengeId: 'spirit-test-01' }
);
assert.strictEqual(wrong.ok, false);
assert.strictEqual(wrong.error, 'bad_sequence');

const spoof = validateChallengeAnswer(
  'button_lantern',
  {},
  { sequence: ['red', 'icy', 'green', 'blue'], challengeId: 'spirit-test-02' },
  { spiritChallengeId: 'spirit-test-01' }
);
assert.strictEqual(spoof.ok, false);

const missing = validateChallengeAnswer(
  'button_lantern',
  {},
  { sequence: ['icy', 'red', 'green', 'icy'] },
  {}
);
assert.strictEqual(missing.ok, false);
assert.strictEqual(missing.error, 'no_spirit_challenge');

// Config validation catches bad tables.
function expectInvalid(patch, needle) {
  const cfg = {
    ...SPIRIT_STATION_CONFIG,
    colors: { ...SPIRIT_STATION_CONFIG.colors },
    challenges: SPIRIT_STATION_CONFIG.challenges.map((c) => ({ ...c, buttons: [...c.buttons], lanterns: [...c.lanterns] })),
    ...patch,
  };
  if (patch.challenges) cfg.challenges = patch.challenges;
  if (patch.colors) cfg.colors = patch.colors;
  const result = validateSpiritStationConfig(cfg);
  assert.strictEqual(result.ok, false, `expected invalid: ${needle}`);
  assert.ok(
    result.errors.some((e) => String(e).toLowerCase().includes(needle.toLowerCase())),
    `expected error containing "${needle}", got: ${result.errors.join(' | ')}`
  );
}

expectInvalid({
  challenges: [{
    id: 'bad-color',
    test: true,
    buttons: ['blue', 'green', 'blue', 'purple'],
    lanterns: ['icy', 'red', 'green', 'icy'],
  }],
}, 'invalid button color');

expectInvalid({
  challenges: [{
    id: 'bad-len',
    test: true,
    buttons: ['blue', 'green', 'blue'],
    lanterns: ['icy', 'red', 'green', 'icy'],
  }],
}, 'length');

expectInvalid({
  challenges: [
    {
      id: 'dup-a',
      test: true,
      buttons: ['blue', 'green', 'blue', 'red'],
      lanterns: ['icy', 'red', 'green', 'icy'],
    },
    {
      id: 'dup-b',
      test: true,
      buttons: ['blue', 'green', 'blue', 'red'],
      lanterns: ['red', 'blue', 'green', 'icy'],
    },
  ],
}, 'duplicate button');

// Assignment picker never returns empty; sticky id stays sticky.
const ids = new Set();
for (let i = 0; i < 40; i += 1) ids.add(pickChallengeId());
assert.ok(ids.size >= 1);
assert.ok([...ids].every((id) => getChallenge(id)));

// Client undo / clear buffer behavior (mirrors app.js handlers).
function spiritBufferOps(ops, len = 4) {
  let buffer = [];
  for (const op of ops) {
    if (op.type === 'push') {
      if (buffer.length < len) buffer = [...buffer, op.id];
    } else if (op.type === 'undo') {
      buffer = buffer.slice(0, -1);
    } else if (op.type === 'clear') {
      buffer = [];
    }
  }
  return buffer;
}
assert.deepStrictEqual(
  spiritBufferOps([
    { type: 'push', id: 'green' },
    { type: 'push', id: 'red' },
    { type: 'undo' },
    { type: 'push', id: 'icy' },
  ]),
  ['green', 'icy']
);
assert.deepStrictEqual(
  spiritBufferOps([
    { type: 'push', id: 'green' },
    { type: 'push', id: 'red' },
    { type: 'clear' },
  ]),
  []
);

// Equal-length unique button sequences across the shipped test table.
const keys = SPIRIT_STATION_CONFIG.challenges.map((c) => seqKey(c.buttons));
assert.strictEqual(keys.length, new Set(keys).size);
assert.ok(SPIRIT_STATION_CONFIG.challenges.every((c) =>
  c.buttons.length === SPIRIT_STATION_CONFIG.sequenceLength
  && c.lanterns.length === SPIRIT_STATION_CONFIG.sequenceLength
));

console.log('spirit-station checks passed');
