#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

if (!process.env.DATA_DIR) {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ic-spirit-mig-'));
}

(async () => {
  const { migrate } = require('../server/schema');
  const db = require('../server/db');
  const { ensureQuestStationsAll, CHALLENGES } = require('../server/questStations');
  const { now } = require('../server/helpers');

  await migrate();
  const adv = await db.get('SELECT id FROM adventures WHERE is_active = 1 LIMIT 1');
  await db.run(
    'UPDATE touchpoints SET challenge_type = ?, config = ?, updated_at = ? WHERE adventure_id = ? AND slug = ?',
    [
      'multi_sequence',
      JSON.stringify({
        prompt: 'Aurora’s symbols bring the five elements into harmony. Find the sequence nearby, then tap the symbols on your screen in the same order.',
        kind: 'symbol',
        length: 5,
        accepted: [['water', 'earth', 'fire', 'air', 'spirit']],
      }),
      now(),
      adv.id,
      'aurora',
    ]
  );

  await ensureQuestStationsAll();
  const row = await db.get(
    'SELECT challenge_type, config FROM touchpoints WHERE adventure_id = ? AND slug = ?',
    [adv.id, 'aurora']
  );
  assert.strictEqual(row.challenge_type, 'button_lantern');
  const cfg = JSON.parse(row.config);
  assert.strictEqual(cfg.prompt, CHALLENGES.aurora.config.prompt);
  console.log('aurora migration checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
