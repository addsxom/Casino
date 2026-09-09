const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HOUSE_EDGE,
  MAX_CRASH,
  LIVE_UPDATE_MS,
  generateCrashPoint,
  getMultiplierAt
} = require('../utils/crash/gameRules.js');

test('crash production settings stay unchanged', () => {
  assert.equal(HOUSE_EDGE, 0.03);
  assert.equal(MAX_CRASH, 100);
  assert.equal(LIVE_UPDATE_MS, 900);
});

test('crash point respects floor and cap', () => {
  const originalRandom = Math.random;

  try {
    Math.random = () => 0;
    assert.equal(generateCrashPoint(), 1);

    Math.random = () => 0.5;
    assert.equal(generateCrashPoint(), 1.94);

    Math.random = () => 0.999999;
    assert.equal(generateCrashPoint(), MAX_CRASH);
  } finally {
    Math.random = originalRandom;
  }
});

test('live multiplier starts at x1, rises and stays capped', () => {
  const startedAt = 1_000_000;

  assert.equal(getMultiplierAt(startedAt, startedAt), 1);

  const afterFiveSeconds =
    getMultiplierAt(startedAt, startedAt + 5000);
  const afterTenSeconds =
    getMultiplierAt(startedAt, startedAt + 10000);

  assert.ok(afterFiveSeconds > 1);
  assert.ok(afterTenSeconds > afterFiveSeconds);

  assert.equal(
    getMultiplierAt(startedAt, startedAt + 10_000_000),
    MAX_CRASH
  );
});
