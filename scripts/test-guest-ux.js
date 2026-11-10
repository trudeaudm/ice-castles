#!/usr/bin/env node
/**
 * Lightweight checks for guest UX fixes that do not need a browser.
 * Run: node scripts/test-guest-ux.js
 */
const assert = require('assert');
const { validateChallengeAnswer } = require('../server/adventures');

const cascadeCfg = {
  correctIds: ['ice-vein', 'ice-arch', 'ice-ripple'],
  selectCount: 3,
};

function expectImage(answer, ok, error) {
  const result = validateChallengeAnswer('image_select', cascadeCfg, answer);
  assert.strictEqual(result.ok, ok, JSON.stringify({ answer, result }));
  if (!ok) assert.strictEqual(result.error, error);
}

// Count / correctness (server still uses bad_images; client blocks early).
expectImage({ ids: [] }, false, 'bad_images');
expectImage({ ids: ['ice-vein'] }, false, 'bad_images');
expectImage({ ids: ['ice-vein', 'ice-arch'] }, false, 'bad_images');
expectImage({ ids: ['ice-vein', 'ice-arch', 'lantern-glow'] }, false, 'bad_images');
expectImage({ ids: ['ice-vein', 'ice-arch', 'ice-ripple'] }, true);
expectImage({ ids: ['ice-vein', 'ice-arch', 'ice-ripple', 'lantern-glow'] }, false, 'bad_images');

// Client-side selection rules mirrored here for regression clarity.
function clientPick(selected, id, need = 3) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else if (next.size >= need) return { blocked: true, selected: [...selected] };
  else next.add(id);
  return { blocked: false, selected: [...next] };
}

assert.deepStrictEqual(clientPick([], 'a').selected, ['a']);
assert.deepStrictEqual(clientPick(['a'], 'b').selected, ['a', 'b']);
assert.deepStrictEqual(clientPick(['a', 'b'], 'c').selected, ['a', 'b', 'c']);
assert.strictEqual(clientPick(['a', 'b', 'c'], 'd').blocked, true);
assert.deepStrictEqual(clientPick(['a', 'b', 'c'], 'b').selected, ['a', 'c']);

const reducedOff = !/^(1|true|yes|on)$/i.test(String(process.env.GUEST_REDUCED_MOTION || ''));
assert.strictEqual(reducedOff, true, 'default GUEST_REDUCED_MOTION must be off for this process');

console.log('guest-ux checks passed');
