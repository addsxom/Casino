const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ROBBER_COOLDOWN_MS,
  VICTIM_PROTECTION_MS,
  MIN_TARGET_POCKET,
  SUCCESS_CHANCE,
  JACKPOT_CHANCE,
  FINE_CHANCE,
  randomInt
} = require('../utils/rob/rules.js');

test('rob production rules stay unchanged', () => {
  assert.equal(ROBBER_COOLDOWN_MS, 2 * 60 * 60 * 1000);
  assert.equal(VICTIM_PROTECTION_MS, 60 * 60 * 1000);
  assert.equal(MIN_TARGET_POCKET, 1000);
  assert.equal(SUCCESS_CHANCE, 0.55);
  assert.equal(JACKPOT_CHANCE, 0.05);
  assert.equal(FINE_CHANCE, 0.50);
});

test('randomInt includes both configured boundaries', () => {
  const originalRandom = Math.random;

  try {
    Math.random = () => 0;
    assert.equal(randomInt(5, 10), 5);

    Math.random = () => 0.999999;
    assert.equal(randomInt(5, 10), 10);
  } finally {
    Math.random = originalRandom;
  }
});
