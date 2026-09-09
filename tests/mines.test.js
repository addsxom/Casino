const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BONUS_CHANCE,
  BONUS_BALANCE_FACTOR,
  REVEAL_COST_PERCENT,
  REVEAL_COOLDOWN_MS,
  MODES,
  formatCooldown,
  getBaseMultiplier,
  generateMines,
  generateBonusPositions,
  getMaxBetWithReveal
} = require('../utils/mines/gameRules.js');

test('mines production settings stay balanced', () => {
  assert.equal(BONUS_CHANCE, 0.10);
  assert.equal(BONUS_BALANCE_FACTOR, 1.10);
  assert.equal(REVEAL_COST_PERCENT, 0.20);
  assert.equal(REVEAL_COOLDOWN_MS, 2 * 60 * 1000);

  assert.deepEqual(
    {
      rows: MODES.rapide.rows,
      cols: MODES.rapide.cols,
      mines: MODES.rapide.mines
    },
    { rows: 3, cols: 3, mines: 1 }
  );

  assert.deepEqual(
    {
      rows: MODES.classique.rows,
      cols: MODES.classique.cols,
      mines: MODES.classique.mines
    },
    { rows: 4, cols: 4, mines: 3 }
  );

  assert.deepEqual(
    {
      rows: MODES.complexe.rows,
      cols: MODES.complexe.cols,
      mines: MODES.complexe.mines
    },
    { rows: 4, cols: 5, mines: 6 }
  );
});

test('mines multiplier starts at one and increases', () => {
  assert.equal(getBaseMultiplier(16, 3, 0), 1);

  const first = getBaseMultiplier(16, 3, 1);
  const second = getBaseMultiplier(16, 3, 2);

  assert.ok(first > 1);
  assert.ok(second > first);
});

test('reveal reserve never exceeds the pocket', () => {
  const cases = [0, 1, 10, 1000, 10_000];

  for (const balance of cases) {
    const bet = getMaxBetWithReveal(balance);
    const revealCost = bet > 0
      ? Math.max(1, Math.ceil(bet * REVEAL_COST_PERCENT))
      : 0;

    assert.ok(bet >= 0);
    assert.ok(bet + revealCost <= balance);
  }

  assert.equal(getMaxBetWithReveal(1000), 833);
});

test('cooldown formatting is stable', () => {
  assert.equal(formatCooldown(0), '00:00');
  assert.equal(formatCooldown(1000), '00:01');
  assert.equal(formatCooldown(120000), '02:00');
});

test('mine and bonus generation never put a bonus on a mine', () => {
  const originalRandom = Math.random;

  try {
    Math.random = () => 0.99;
    const mines = generateMines(5, 1);

    assert.equal(mines.size, 1);
    assert.equal([...mines][0], 4);

    Math.random = () => 0;
    const bonuses = generateBonusPositions(5, mines);

    assert.equal(bonuses.has(4), false);
    assert.equal(bonuses.size, 4);
  } finally {
    Math.random = originalRandom;
  }
});
