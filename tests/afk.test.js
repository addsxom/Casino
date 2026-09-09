const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AFK_REWARD_MIN_MS,
  AFK_REWARD_MAX_MS,
  AFK_REWARD_COINS
} = require('../utils/rewardService.js');

const {
  getRandomAfkInterval
} = require('../utils/afkRewardTracker.js');

test('afk farm reward settings stay unchanged', () => {
  assert.equal(
    AFK_REWARD_MIN_MS,
    30 * 60 * 1000
  );

  assert.equal(
    AFK_REWARD_MAX_MS,
    40 * 60 * 1000
  );

  assert.equal(
    AFK_REWARD_COINS,
    250
  );
});

test('afk farm random timer stays between 30 and 40 minutes', () => {
  const originalRandom =
    Math.random;

  try {
    Math.random = () => 0;

    assert.equal(
      getRandomAfkInterval(),
      AFK_REWARD_MIN_MS
    );

    Math.random =
      () => 0.999999;

    const nearMax =
      getRandomAfkInterval();

    assert.ok(
      nearMax >= AFK_REWARD_MIN_MS
    );

    assert.ok(
      nearMax <= AFK_REWARD_MAX_MS
    );
  } finally {
    Math.random = originalRandom;
  }
});
