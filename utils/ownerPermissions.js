const Owner = require('../Models/Owner.js');

function isBuyer(userId) {
  return Boolean(userId) && userId === process.env.BUYER;
}

async function isBotOwner(userId) {
  if (!userId) return false;
  if (isBuyer(userId)) return true;

  return Boolean(
    await Owner.exists({ userId })
  );
}

async function requireBotOwner(message, denialMessage = '❌・Tu dois être owner du bot pour utiliser cette commande.') {
  if (await isBotOwner(message?.author?.id)) {
    return true;
  }

  if (message?.reply) {
    await message.reply(denialMessage).catch(() => {});
  }

  return false;
}

async function requireBuyer(message, denialMessage = '❌・Seul le BUYER du bot peut utiliser cette commande.') {
  if (isBuyer(message?.author?.id)) {
    return true;
  }

  if (message?.reply) {
    await message.reply(denialMessage).catch(() => {});
  }

  return false;
}

module.exports = {
  isBuyer,
  isBotOwner,
  requireBotOwner,
  requireBuyer
};
