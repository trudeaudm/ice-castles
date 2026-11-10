#!/usr/bin/env node
/**
 * Assignment persistence against a temporary SQLite database.
 * Run: node scripts/test-spirit-persistence.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.env.DATA_DIR) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ic-spirit-'));
  process.env.DATA_DIR = dir;
}

(async () => {
  const { migrate } = require('../server/schema');
  const db = require('../server/db');
  const quest = require('../server/quest');
  const { uuid, now } = require('../server/helpers');
  const { getChallenge } = require('../server/spiritStationConfig');
  const { validateChallengeAnswer } = require('../server/adventures');

  await migrate();

  const guestId = uuid();
  const ts = now();
  await db.run(
    'INSERT INTO guests (id, nickname, created_at, last_seen_at, visits) VALUES (?,?,?,?,1)',
    [guestId, null, ts, ts]
  );
  const adv = await db.get('SELECT id FROM adventures WHERE is_active = 1 ORDER BY year DESC LIMIT 1');
  assert.ok(adv, 'expected seeded adventure');

  const started = await quest.startSession(guestId, adv.id, 'aurora', null, 2);
  assert.strictEqual(started.row.spirit_challenge_id, null);

  const first = await quest.assignSpiritChallenge(started.row);
  assert.strictEqual(first.created, true);
  assert.ok(first.assignment?.challengeId);
  const challenge = getChallenge(first.assignment.challengeId);
  assert.ok(challenge);
  assert.deepStrictEqual(first.assignment.buttons, challenge.buttons);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(first.assignment, 'lanterns'), false);

  const again = await quest.assignSpiritChallenge(first.row);
  assert.strictEqual(again.created, false);
  assert.strictEqual(again.assignment.challengeId, first.assignment.challengeId);

  const reloaded = await quest.loadSession(guestId, adv.id);
  assert.strictEqual(reloaded.spirit_challenge_id, first.assignment.challengeId);
  const pub = quest.publicSession(reloaded, []);
  assert.strictEqual(pub.spiritChallengeId, first.assignment.challengeId);
  assert.deepStrictEqual(pub.spiritChallenge.buttons, first.assignment.buttons);

  const correct = validateChallengeAnswer(
    'button_lantern',
    {},
    { sequence: challenge.lanterns, challengeId: challenge.id },
    { spiritChallengeId: reloaded.spirit_challenge_id }
  );
  assert.strictEqual(correct.ok, true);

  const incorrect = validateChallengeAnswer(
    'button_lantern',
    {},
    { sequence: challenge.buttons, challengeId: challenge.id },
    { spiritChallengeId: reloaded.spirit_challenge_id }
  );
  assert.strictEqual(incorrect.ok, false);

  const aurora = await db.get(
    'SELECT challenge_type, config FROM touchpoints WHERE adventure_id = ? AND slug = ?',
    [adv.id, 'aurora']
  );
  assert.strictEqual(aurora.challenge_type, 'button_lantern');
  const cfg = JSON.parse(aurora.config);
  assert.ok(cfg.pressPrompt);
  assert.ok(cfg.enterPrompt);
  assert.ok(cfg.partyNote);

  console.log('spirit persistence checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
