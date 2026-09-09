const config = require('../../config/botConfig.js');

const SLOT_CONFIG = config.games.slots;

const NORMAL_SYMBOLS = [
  '🍒',
  '🍋',
  '🍇',
  '🔔',
  '💎'
];

const SEVEN_SYMBOL = '7️⃣';
const ALL_SYMBOLS = [
  ...NORMAL_SYMBOLS,
  SEVEN_SYMBOL
];

function randomItem(items) {
  return items[
    Math.floor(Math.random() * items.length)
  ];
}

function getBetAmount(cagnotte, ratio) {
  const amount = Math.floor(
    Math.max(0, Number(cagnotte) || 0) *
      ratio
  );

  return Math.max(0, amount);
}

function getBetOptions(cagnotte) {
  const total = Math.max(
    0,
    Math.floor(Number(cagnotte) || 0)
  );

  const options = [];
  const used = new Set();

  const addOption = (
    key,
    label,
    ratio,
    style
  ) => {
    const amount =
      ratio === 1
        ? total
        : getBetAmount(total, ratio);

    if (
      amount <= 0 ||
      used.has(amount)
    ) {
      return;
    }

    used.add(amount);

    options.push({
      key,
      label,
      amount,
      style
    });
  };

  addOption(
    '25',
    '25%',
    0.25,
    'primary'
  );

  addOption(
    '50',
    '50%',
    0.50,
    'primary'
  );

  addOption(
    'all',
    'All',
    1,
    'success'
  );

  return options;
}

function generateWinningReels() {
  if (
    Math.random() <
      SLOT_CONFIG.sevenOnWinChance
  ) {
    return [
      SEVEN_SYMBOL,
      SEVEN_SYMBOL,
      SEVEN_SYMBOL
    ];
  }

  const symbol =
    randomItem(NORMAL_SYMBOLS);

  return [
    symbol,
    symbol,
    symbol
  ];
}

function generateLosingReels() {
  const reels = [
    randomItem(ALL_SYMBOLS),
    randomItem(ALL_SYMBOLS),
    randomItem(ALL_SYMBOLS)
  ];

  if (
    reels[0] === reels[1] &&
    reels[1] === reels[2]
  ) {
    const alternatives =
      ALL_SYMBOLS.filter(
        symbol => symbol !== reels[2]
      );

    reels[2] =
      randomItem(alternatives);
  }

  return reels;
}

function generateOutcome() {
  const isWin =
    Math.random() <
    SLOT_CONFIG.winChance;

  const reels = isWin
    ? generateWinningReels()
    : generateLosingReels();

  return {
    reels,
    isWin,
    isSeven:
      reels.every(
        symbol =>
          symbol === SEVEN_SYMBOL
      )
  };
}

function generateRollingReels(
  finalReels,
  stoppedCount
) {
  return finalReels.map(
    (symbol, index) =>
      index < stoppedCount
        ? symbol
        : randomItem(ALL_SYMBOLS)
  );
}

module.exports = {
  NORMAL_SYMBOLS,
  ALL_SYMBOLS,
  SEVEN_SYMBOL,
  getBetAmount,
  getBetOptions,
  generateOutcome,
  generateRollingReels
};
