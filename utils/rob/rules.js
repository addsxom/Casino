const UserRobProtection =
  require('../../Models/UserRobProtection.js');

const ROBBER_COOLDOWN_MS =
  2 * 60 * 60 * 1000;
const VICTIM_PROTECTION_MS =
  60 * 60 * 1000;
const MIN_TARGET_POCKET = 1000;

const SUCCESS_CHANCE = 0.55;
const JACKPOT_CHANCE = 0.05;
const FINE_CHANCE = 0.50;

function randomInt(min, max) {
  return Math.floor(
    Math.random() *
      (max - min + 1)
  ) + min;
}

async function getProtection(
  userId,
  guildId
) {
  const protection =
    await UserRobProtection.findOne({
      userId,
      guildId
    });

  const availableAt =
    Number(protection?.cooldown) || 0;

  return {
    active:
      availableAt > Date.now(),
    availableAt
  };
}

module.exports = {
  ROBBER_COOLDOWN_MS,
  VICTIM_PROTECTION_MS,
  MIN_TARGET_POCKET,
  SUCCESS_CHANCE,
  JACKPOT_CHANCE,
  FINE_CHANCE,
  randomInt,
  getProtection
};
