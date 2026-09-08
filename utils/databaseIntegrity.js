const UserCoins = require('../Models/UserCoins.js');
const MinesCooldown = require('../Models/MinesCooldown.js');
const UserDailyCooldown = require('../Models/UserDailyCooldown.js');
const UserWorkCooldown = require('../Models/UserWorkCooldown.js');
const UserRepCooldown = require('../Models/UserRepCooldown.js');
const UserRobCooldown = require('../Models/UserRobCooldown.js');
const ServerPrefix = require('../Models/ServerPrefix.js');
const Owner = require('../Models/Owner.js');

async function mergeUserCoinDuplicates() {
  const duplicates = await UserCoins.aggregate([
    {
      $group: {
        _id: {
          userId: '$userId',
          guildId: '$guildId'
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
        coins: { $sum: { $ifNull: ['$coins', 0] } },
        bank: { $sum: { $ifNull: ['$bank', 0] } },
        rep: { $sum: { $ifNull: ['$rep', 0] } },
        messages: { $sum: { $ifNull: ['$messages', 0] } }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  for (const duplicate of duplicates) {
    const [keepId, ...removeIds] = duplicate.ids;

    await UserCoins.updateOne(
      { _id: keepId },
      {
        $set: {
          coins: duplicate.coins,
          bank: duplicate.bank,
          rep: duplicate.rep,
          messages: duplicate.messages
        }
      }
    );

    if (removeIds.length) {
      await UserCoins.deleteMany({
        _id: { $in: removeIds }
      });
    }
  }

  return duplicates.length;
}

async function mergeNumericCooldownDuplicates(Model) {
  const duplicates = await Model.aggregate([
    {
      $group: {
        _id: {
          userId: '$userId',
          guildId: '$guildId'
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
        cooldown: { $max: { $ifNull: ['$cooldown', 0] } }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  for (const duplicate of duplicates) {
    const [keepId, ...removeIds] = duplicate.ids;

    await Model.updateOne(
      { _id: keepId },
      {
        $set: {
          cooldown: duplicate.cooldown
        }
      }
    );

    if (removeIds.length) {
      await Model.deleteMany({
        _id: { $in: removeIds }
      });
    }
  }

  return duplicates.length;
}

async function mergeMinesCooldownDuplicates() {
  const duplicates = await MinesCooldown.aggregate([
    {
      $group: {
        _id: {
          userId: '$userId',
          guildId: '$guildId'
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
        revealAvailableAt: { $max: '$revealAvailableAt' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  for (const duplicate of duplicates) {
    const [keepId, ...removeIds] = duplicate.ids;

    await MinesCooldown.updateOne(
      { _id: keepId },
      {
        $set: {
          revealAvailableAt: duplicate.revealAvailableAt || null
        }
      }
    );

    if (removeIds.length) {
      await MinesCooldown.deleteMany({
        _id: { $in: removeIds }
      });
    }
  }

  return duplicates.length;
}

async function createDeclaredIndexes() {
  const models = [
    UserCoins,
    MinesCooldown,
    UserDailyCooldown,
    UserWorkCooldown,
    UserRepCooldown,
    UserRobCooldown,
    ServerPrefix,
    Owner
  ];

  for (const Model of models) {
    await Model.createIndexes();
  }
}

async function ensureDatabaseIntegrity() {
  const results = {
    userCoins: await mergeUserCoinDuplicates(),
    dailyCooldowns:
      await mergeNumericCooldownDuplicates(UserDailyCooldown),
    workCooldowns:
      await mergeNumericCooldownDuplicates(UserWorkCooldown),
    repCooldowns:
      await mergeNumericCooldownDuplicates(UserRepCooldown),
    robCooldowns:
      await mergeNumericCooldownDuplicates(UserRobCooldown),
    minesCooldowns:
      await mergeMinesCooldownDuplicates()
  };

  await createDeclaredIndexes();

  const mergedCollections = Object.entries(results)
    .filter(([, count]) => count > 0);

  if (mergedCollections.length) {
    const summary = mergedCollections
      .map(([name, count]) => `${name}: ${count}`)
      .join(' • ');

    console.log(
      `Database • doublons fusionnés avant indexation : ${summary}`
    );
  }

  console.log(
    'Database • index uniques vérifiés/créés'
  );

  return results;
}

module.exports = {
  ensureDatabaseIntegrity
};
