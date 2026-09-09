const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBetOptions,
  generateOutcome,
  SEVEN_SYMBOL
} = require('../utils/slots/gameRules.js');

test('slot bet buttons calculate 25, 50 and all amounts', () => {
  const options =
    getBetOptions(1000);

  assert.deepEqual(
    options.map(option => [
      option.key,
      option.amount
    ]),
    [
      ['25', 250],
      ['50', 500],
      ['all', 1000]
    ]
  );
});

test('slot bet buttons stay usable with a tiny cagnotte', () => {
  const options =
    getBetOptions(3);

  assert.deepEqual(
    options.map(option => [
      option.key,
      option.amount
    ]),
    [
      ['50', 1],
      ['all', 3]
    ]
  );
});

test('slot outcomes match their displayed reels', () => {
  for (let i = 0; i < 200; i++) {
    const outcome =
      generateOutcome();

    assert.equal(
      outcome.reels.length,
      3
    );

    const triple =
      outcome.reels[0] ===
        outcome.reels[1] &&
      outcome.reels[1] ===
        outcome.reels[2];

    assert.equal(
      triple,
      outcome.isWin
    );

    assert.equal(
      outcome.isSeven,
      outcome.reels.every(
        symbol =>
          symbol ===
          SEVEN_SYMBOL
      )
    );
  }
});
