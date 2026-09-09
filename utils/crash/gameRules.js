const config = require('../../config/botConfig.js');

const {
  houseEdge: HOUSE_EDGE,
  maxCrash: MAX_CRASH,
  liveUpdateMs: LIVE_UPDATE_MS
} = config.games.crash;

function generateCrashPoint() {
  const random = Math.random();
  const raw =
    (1 - HOUSE_EDGE) /
    (1 - random);

  const point =
    Math.floor(raw * 100) / 100;

  return Math.min(
    MAX_CRASH,
    Math.max(1, point)
  );
}

function getMultiplierAt(
  startedAt,
  at = Date.now()
) {
  const elapsedSeconds = Math.max(
    0,
    (at - startedAt) / 1000
  );

  const exponent =
    0.05 * elapsedSeconds +
    0.0015 *
      elapsedSeconds *
      elapsedSeconds;

  return Number(
    Math.min(
      MAX_CRASH,
      Math.exp(exponent)
    ).toFixed(2)
  );
}

module.exports = {
  HOUSE_EDGE,
  MAX_CRASH,
  LIVE_UPDATE_MS,
  generateCrashPoint,
  getMultiplierAt
};
