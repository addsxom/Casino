const config = require('../../config/botConfig.js');

const {
  bonusChance: BONUS_CHANCE,
  revealCostPercent: REVEAL_COST_PERCENT,
  revealCooldownMs: REVEAL_COOLDOWN_MS
} = config.games.mines;

const BONUS_BALANCE_FACTOR =
  1 + BONUS_CHANCE;

const MODES = {
  rapide: {
    label: '⚡ Rapide',
    rows: 3,
    cols: 3,
    mines: 1,
    color: 0x3498db
  },
  classique: {
    label: '💣 Classique',
    rows: 4,
    cols: 4,
    mines: 3,
    color: 0x6b6de6
  },
  complexe: {
    label: '🔥 Complexe',
    rows: 4,
    cols: 5,
    mines: 6,
    color: 0xe67e22
  }
};

function formatCooldown(ms) {
  const totalSeconds = Math.max(
    0,
    Math.ceil(ms / 1000)
  );
  const minutes = Math.floor(
    totalSeconds / 60
  );
  const seconds = totalSeconds % 60;

  return (
    `${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')}`
  );
}

function getBaseMultiplier(
  totalCells,
  mines,
  safeOpened
) {
  if (safeOpened <= 0) return 1;

  let survivalProbability = 1;

  for (let i = 0; i < safeOpened; i++) {
    survivalProbability *=
      (totalCells - mines - i) /
      (totalCells - i);
  }

  return Math.max(
    1,
    0.97 / survivalProbability
  );
}

function generateMines(
  totalCells,
  mineCount
) {
  const positions = new Set();

  while (positions.size < mineCount) {
    positions.add(
      Math.floor(Math.random() * totalCells)
    );
  }

  return positions;
}

function generateBonusPositions(
  totalCells,
  minePositions
) {
  const positions = new Set();

  for (let i = 0; i < totalCells; i++) {
    if (
      !minePositions.has(i) &&
      Math.random() < BONUS_CHANCE
    ) {
      positions.add(i);
    }
  }

  return positions;
}

function getMaxBetWithReveal(balance) {
  let amount = Math.floor(
    balance /
      (1 + REVEAL_COST_PERCENT)
  );

  while (
    amount > 0 &&
    amount +
      Math.max(
        1,
        Math.ceil(
          amount * REVEAL_COST_PERCENT
        )
      ) >
      balance
  ) {
    amount--;
  }

  return Math.max(0, amount);
}

module.exports = {
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
};
