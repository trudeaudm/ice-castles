/**
 * Spirit station — physical button → lantern mapping (app side).
 *
 * KEEP IN SYNC: The physical station firmware and this table must be updated
 * together. Changing one without the other breaks guest play. There is no
 * network link between the app and the station; both sides look up the same
 * challenge IDs and sequences from their own copies of this mapping.
 *
 * TEST DATA: Challenges marked test:true are placeholders until the station
 * is programmed with the same table. Replace them with production mappings
 * and bump `version` when the station table changes.
 */

const SPIRIT_STATION_CONFIG = {
  version: 1,
  sequenceLength: 4,
  colors: {
    blue: { id: 'blue', label: 'Blue', symbol: '●', number: 1, hex: '#3d8bfd' },
    amber: { id: 'amber', label: 'Amber', symbol: '▲', number: 2, hex: '#ffb455' },
    white: { id: 'white', label: 'White', symbol: '◇', number: 3, hex: '#f4fbff' },
    green: { id: 'green', label: 'Green', symbol: '■', number: 4, hex: '#5df0a0' },
  },
  /**
   * Each challenge: unique button input sequence → matching lantern answer.
   * Guests press `buttons` on the station; the station plays `lanterns`;
   * the app asks for `lanterns` as the answer.
   */
  challenges: [
    {
      id: 'spirit-test-01',
      test: true,
      buttons: ['blue', 'amber', 'blue', 'white'],
      lanterns: ['green', 'white', 'amber', 'green'],
    },
    {
      id: 'spirit-test-02',
      test: true,
      buttons: ['green', 'blue', 'amber', 'white'],
      lanterns: ['amber', 'green', 'white', 'blue'],
    },
    {
      id: 'spirit-test-03',
      test: true,
      buttons: ['white', 'green', 'blue', 'amber'],
      lanterns: ['blue', 'amber', 'green', 'white'],
    },
    {
      id: 'spirit-test-04',
      test: true,
      buttons: ['amber', 'white', 'green', 'blue'],
      lanterns: ['white', 'blue', 'amber', 'green'],
    },
  ],
};

function colorIds(config = SPIRIT_STATION_CONFIG) {
  return Object.keys(config.colors || {});
}

function normalizeSeq(seq) {
  return (Array.isArray(seq) ? seq : []).map((v) => String(v || '').toLowerCase().trim());
}

function seqKey(seq) {
  return normalizeSeq(seq).join('|');
}

/**
 * Validate the mapping table. Returns { ok, errors[] }.
 * Rejects unknown colors, length mismatches, empty/duplicate IDs,
 * and duplicate button-input sequences.
 */
function validateSpiritStationConfig(config = SPIRIT_STATION_CONFIG) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['config must be an object'] };
  }
  if (!Number.isInteger(config.version) || config.version < 1) {
    errors.push('version must be a positive integer');
  }
  const colors = config.colors || {};
  const known = new Set(Object.keys(colors));
  if (!known.size) errors.push('colors must not be empty');
  for (const [id, meta] of Object.entries(colors)) {
    if (!meta || meta.id !== id) errors.push(`color ${id} must include matching id`);
    if (!meta?.label) errors.push(`color ${id} needs a label`);
    if (!meta?.symbol) errors.push(`color ${id} needs a symbol`);
    if (!Number.isFinite(Number(meta?.number))) errors.push(`color ${id} needs a number`);
    if (!meta?.hex) errors.push(`color ${id} needs a hex`);
  }

  const length = Number(config.sequenceLength);
  if (!Number.isInteger(length) || length < 1) {
    errors.push('sequenceLength must be a positive integer');
  }

  const challenges = Array.isArray(config.challenges) ? config.challenges : [];
  if (!challenges.length) errors.push('challenges must not be empty');

  const seenIds = new Set();
  const seenButtons = new Set();
  for (const challenge of challenges) {
    const id = String(challenge?.id || '').trim();
    if (!id) {
      errors.push('challenge missing id');
      continue;
    }
    if (seenIds.has(id)) errors.push(`duplicate challenge id: ${id}`);
    seenIds.add(id);

    const buttons = normalizeSeq(challenge.buttons);
    const lanterns = normalizeSeq(challenge.lanterns);
    if (buttons.length !== length) {
      errors.push(`${id}: buttons length ${buttons.length} !== sequenceLength ${length}`);
    }
    if (lanterns.length !== length) {
      errors.push(`${id}: lanterns length ${lanterns.length} !== sequenceLength ${length}`);
    }
    if (buttons.length !== lanterns.length) {
      errors.push(`${id}: buttons and lanterns lengths differ`);
    }
    for (const c of buttons) {
      if (!known.has(c)) errors.push(`${id}: invalid button color "${c}"`);
    }
    for (const c of lanterns) {
      if (!known.has(c)) errors.push(`${id}: invalid lantern color "${c}"`);
    }
    const key = seqKey(buttons);
    if (!key) errors.push(`${id}: empty button sequence`);
    else if (seenButtons.has(key)) errors.push(`${id}: duplicate button sequence ${key}`);
    seenButtons.add(key);
  }

  return { ok: errors.length === 0, errors };
}

function assertSpiritStationConfig(config = SPIRIT_STATION_CONFIG) {
  const result = validateSpiritStationConfig(config);
  if (!result.ok) {
    throw new Error(`Invalid Spirit station config:\n- ${result.errors.join('\n- ')}`);
  }
  return result;
}

function listChallenges(config = SPIRIT_STATION_CONFIG) {
  assertSpiritStationConfig(config);
  return config.challenges.map((c) => ({
    id: c.id,
    test: Boolean(c.test),
    buttons: normalizeSeq(c.buttons),
    lanterns: normalizeSeq(c.lanterns),
  }));
}

function getChallenge(challengeId, config = SPIRIT_STATION_CONFIG) {
  assertSpiritStationConfig(config);
  const id = String(challengeId || '').trim();
  return listChallenges(config).find((c) => c.id === id) || null;
}

function pickChallengeId(excludeId, config = SPIRIT_STATION_CONFIG) {
  const all = listChallenges(config);
  const pool = excludeId ? all.filter((c) => c.id !== excludeId) : all;
  const use = pool.length ? pool : all;
  const index = Math.floor(Math.random() * use.length);
  return use[index].id;
}

function publicColors(config = SPIRIT_STATION_CONFIG) {
  assertSpiritStationConfig(config);
  return Object.values(config.colors).map((c) => ({
    id: c.id,
    label: c.label,
    symbol: c.symbol,
    number: Number(c.number),
    color: c.hex,
  }));
}

/** Guest-safe assignment payload — button sequence only, never lantern answers. */
function publicAssignment(challengeId, config = SPIRIT_STATION_CONFIG) {
  const challenge = getChallenge(challengeId, config);
  if (!challenge) return null;
  return {
    challengeId: challenge.id,
    configVersion: config.version,
    test: challenge.test,
    buttons: challenge.buttons,
    length: challenge.buttons.length,
  };
}

function lanternAnswerMatches(challengeId, sequence, config = SPIRIT_STATION_CONFIG) {
  const challenge = getChallenge(challengeId, config);
  if (!challenge) return false;
  return seqKey(sequence) === seqKey(challenge.lanterns);
}

module.exports = {
  SPIRIT_STATION_CONFIG,
  validateSpiritStationConfig,
  assertSpiritStationConfig,
  listChallenges,
  getChallenge,
  pickChallengeId,
  publicColors,
  publicAssignment,
  lanternAnswerMatches,
  colorIds,
  normalizeSeq,
  seqKey,
};
