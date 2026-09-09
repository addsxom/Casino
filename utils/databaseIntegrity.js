const UserCoins = require('../Models/UserCoins.js');
const MinesCooldown = require('../Models/MinesCooldown.js');
const UserDailyCooldown = require('../Models/UserDailyCooldown.js');
const UserWorkCooldown = require('../Models/UserWorkCooldown.js');
const UserRepCooldown = require('../Models/UserRepCooldown.js');
const UserRobCooldown = require('../Models/UserRobCooldown.js');
const UserRobProtection = require('../Models/UserRobProtection.js');
const VoiceRewardProgress = require('../Models/VoiceRewardProgress.js');
const ServerPrefix = require('../Models/ServerPrefix.js');
const Owner = require('../Models/Owner.js');

async function hasUserGuildUniqueIndex(Model) {
  try {
    const indexes = await Model.collection.indexes();

    return indexes.some(index => {
      const keys = Object.keys(index.key || {});

      return (
        index.unique === true &&
        keys.length === 2 &&
        index.key.userId === 1 &&
        index.key.guildId === 1
      );
    });
  } catch (error) {
    if (error?.code === 26) {
      return false;
    }

    throw error;
  }
}

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
        messages: { $sum: { $ifNull: ['$messages', 0] } },
        messageRewardThreshold: { $max: { $ifNull: ['$messageRewardThreshold', 0] } }
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
          messages: duplicate.messages,
          messageRewardThreshold: duplicate.messageRewardThreshold
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

async function mergeVoiceRewardProgressDuplicates() {
  const duplicates = await VoiceRewardProgress.aggregate([
    {
      $group: {
        _id: {
          userId: '$userId',
          guildId: '$guildId'
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
        latestUpdatedAt: { $max: '$updatedAt' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  for (const duplicate of duplicates) {
    const latest = await VoiceRewardProgress.findOne({
      _id: { $in: duplicate.ids },
      updatedAt: duplicate.latestUpdatedAt
    }).lean();

    if (!latest) continue;

    const removeIds = duplicate.ids.filter(
      id => String(id) !== String(latest._id)
    );

    if (removeIds.length) {
      await VoiceRewardProgress.deleteMany({
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
    UserRobProtection,
    VoiceRewardProgress,
    ServerPrefix,
    Owner
  ];

  for (const Model of models) {
    await Model.createIndexes();
  }
}

async function ensureDatabaseIntegrity() {
  const indexed = {
    userCoins: await hasUserGuildUniqueIndex(UserCoins),
    dailyCooldowns:
      await hasUserGuildUniqueIndex(UserDailyCooldown),
    workCooldowns:
      await hasUserGuildUniqueIndex(UserWorkCooldown),
    repCooldowns:
      await hasUserGuildUniqueIndex(UserRepCooldown),
    robCooldowns:
      await hasUserGuildUniqueIndex(UserRobCooldown),
    robProtections:
      await hasUserGuildUniqueIndex(UserRobProtection),
    minesCooldowns:
      await hasUserGuildUniqueIndex(MinesCooldown),
    voiceRewardProgress:
      await hasUserGuildUniqueIndex(VoiceRewardProgress)
  };

  const results = {
    userCoins: indexed.userCoins
      ? 0
      : await mergeUserCoinDuplicates(),
    dailyCooldowns: indexed.dailyCooldowns
      ? 0
      : await mergeNumericCooldownDuplicates(UserDailyCooldown),
    workCooldowns: indexed.workCooldowns
      ? 0
      : await mergeNumericCooldownDuplicates(UserWorkCooldown),
    repCooldowns: indexed.repCooldowns
      ? 0
      : await mergeNumericCooldownDuplicates(UserRepCooldown),
    robCooldowns: indexed.robCooldowns
      ? 0
      : await mergeNumericCooldownDuplicates(UserRobCooldown),
    robProtections: indexed.robProtections
      ? 0
      : await mergeNumericCooldownDuplicates(UserRobProtection),
    minesCooldowns: indexed.minesCooldowns
      ? 0
      : await mergeMinesCooldownDuplicates(),
    voiceRewardProgress: indexed.voiceRewardProgress
      ? 0
      : await mergeVoiceRewardProgressDuplicates()
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
