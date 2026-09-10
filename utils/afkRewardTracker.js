const AfkRewardProgress =
  require('../Models/AfkRewardProgress.js');
const config =
  require('../config/botConfig.js');

const {
  AFK_REWARD_MIN_MS,
  AFK_REWARD_MAX_MS,
  AFK_REWARD_COINS,
  formatDuration,
  sendAfkRewardNotification,
  sendOrUpdateAfkStatus,
  deleteRewardStatusMessage
} = require('./rewardService.js');

const {
  getConfiguredChannelId
} = require('./configService.js');

const {
  creditBalance
} = require('./economyService.js');

const {
  sendStaffLog,
  buildCoinMovementLog
} = require('./staffLogs.js');

const afkProgress = new Map();

let trackerInterval = null;
let trackerTickRunning = false;
let lastProgressPersistAt = 0;

const PROGRESS_PERSIST_INTERVAL_MS =
  config.system.progressPersistIntervalMs ||
  15 * 1000;

function getKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getRandomAfkInterval() {
  return Math.floor(
    AFK_REWARD_MIN_MS +
    Math.random() *
      (
        AFK_REWARD_MAX_MS -
        AFK_REWARD_MIN_MS +
        1
      )
  );
}

function normalizeTargetMs(value) {
  const target = Number(value);

  if (
    !Number.isFinite(target) ||
    target < AFK_REWARD_MIN_MS ||
    target > AFK_REWARD_MAX_MS
  ) {
    return getRandomAfkInterval();
  }

  return Math.floor(target);
}

function normalizeProgressMs(value, max) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return 0;
  }

  return Math.min(
    Math.floor(number),
    Math.max(0, max)
  );
}

async function loadProgress(
  guild,
  member,
  now
) {
  const saved =
    await AfkRewardProgress.findOne({
      userId: member.id,
      guildId: guild.id
    }).lean();

  const targetMs =
    normalizeTargetMs(saved?.targetMs);

  const validMs =
    normalizeProgressMs(
      saved?.validMs,
      targetMs
    );

  return {
    guild,
    user: member.user,
    validMs,
    targetMs,
    rewardDueAt: null,
    lastCheckedAt: now,
    processing: false,
    status: null,
    statusRewardDueAt: null,
    statusMessage: null,
    statusMessageId:
      saved?.statusMessageId ||
      null,
    suppressEligibleStatus:
      saved?.suppressEligibleStatus ===
      true,
    restoredFromDatabase: Boolean(saved)
  };
}

async function persistProgressBatch(entries) {
  if (!entries.length) return;

  const operations =
    entries.map(progress => ({
      updateOne: {
        filter: {
          userId: progress.user.id,
          guildId: progress.guild.id
        },
        update: {
          $set: {
            validMs:
              Math.floor(progress.validMs),
            targetMs:
              Math.floor(progress.targetMs),
            statusMessageId:
              progress.statusMessageId ||
              null,
            suppressEligibleStatus:
              progress.suppressEligibleStatus ===
              true
          },
          $setOnInsert: {
            userId: progress.user.id,
            guildId: progress.guild.id
          }
        },
        upsert: true
      }
    }));

  await AfkRewardProgress.bulkWrite(
    operations,
    { ordered: false }
  );
}

async function updateStatus(
  progress,
  status,
  nextRewardAt = null
) {
  if (status !== 'eligible') {
    progress.suppressEligibleStatus = false;
  }

  const forceUpdate =
    progress.status !== status ||
    (
      status === 'eligible' &&
      progress.statusRewardDueAt !==
        nextRewardAt
    );

  progress.status = status;
  progress.statusRewardDueAt =
    status === 'eligible'
      ? nextRewardAt
      : null;

  if (
    status === 'eligible' &&
    progress.suppressEligibleStatus &&
    !progress.statusMessage &&
    !progress.statusMessageId
  ) {
    return forceUpdate;
  }

  if (!forceUpdate) return false;

  progress.statusMessage =
    await sendOrUpdateAfkStatus({
      guild: progress.guild,
      user: progress.user,
      status,
      nextRewardAt,
      message: progress.statusMessage,
      messageId:
        progress.statusMessageId
    }).catch(error => {
      console.error(
        'Erreur statut récompense AFK :',
        error
      );

      return progress.statusMessage;
    });

  progress.statusMessageId =
    progress.statusMessage?.id ||
    null;

  return true;
}

async function deleteAfkStatusMessage(
  progress
) {
  await deleteRewardStatusMessage({
    guild: progress.guild,
    message:
      progress.statusMessage,
    messageId:
      progress.statusMessageId
  }).catch(() => false);

  progress.statusMessage = null;
  progress.statusMessageId = null;
}

async function rewardMember(
  member,
  earnedIntervalMs,
  nextIntervalMs
) {
  const account = await creditBalance({
    userId: member.id,
    guildId: member.guild.id,
    target: 'bank',
    amount: AFK_REWARD_COINS
  });

  if (!account) return null;

  const nextRewardAt =
    Date.now() + nextIntervalMs;

  await sendStaffLog(
    member.guild,
    'economy-logs',
    buildCoinMovementLog({
      title: '🛌 Récompense AFK Farm',
      user: member.user,
      delta: AFK_REWARD_COINS,
      pocket: account.coins,
      bank: account.bank,
      reason:
        `${formatDuration(earnedIntervalMs)} dans AFK Farm`,
      details:
        'Micro/casque sans restriction'
    })
  );

  await sendAfkRewardNotification({
    guild: member.guild,
    user: member.user,
    account,
    earnedIntervalMs,
    nextRewardAt,
    coins: AFK_REWARD_COINS
  }).catch(error => {
    console.error(
      'Erreur notification récompense AFK :',
      error
    );
  });

  return {
    nextRewardAt
  };
}

async function cleanupInactiveProgress(bot) {
  const saved =
    await AfkRewardProgress.find({})
      .select(
        '_id userId guildId statusMessageId'
      )
      .lean();

  if (!saved.length) return;

  const activeKeys = new Set();

  for (
    const guild
    of bot.guilds.cache.values()
  ) {
    const afkChannelId =
      getConfiguredChannelId(
        'afkfarm',
        guild.id
      );

    for (
      const voiceState
      of guild.voiceStates.cache.values()
    ) {
      const member = voiceState.member;
      const channel = voiceState.channel;

      if (
        member &&
        !member.user?.bot &&
        channel?.id === afkChannelId
      ) {
        activeKeys.add(
          getKey(guild.id, member.id)
        );
      }
    }
  }

  const staleIds = saved
    .filter(entry =>
      !activeKeys.has(
        getKey(
          entry.guildId,
          entry.userId
        )
      )
    )
    .map(entry => entry._id);

  if (staleIds.length) {
    const staleEntries =
      saved.filter(entry =>
        staleIds.some(
          id =>
            String(id) ===
            String(entry._id)
        )
      );

    for (const entry of staleEntries) {
      const guild =
        bot.guilds.cache.get(
          entry.guildId
        );

      if (
        guild &&
        entry.statusMessageId
      ) {
        await deleteRewardStatusMessage({
          guild,
          messageId:
            entry.statusMessageId
        }).catch(() => false);
      }
    }

    await AfkRewardProgress.deleteMany({
      _id: { $in: staleIds }
    });
  }
}

async function tick(bot) {
  const now = Date.now();
  const activeKeys = new Set();
  const toPersist = [];
  const immediatePersist =
    new Map();

  const persistImmediately =
    progress => {
      immediatePersist.set(
        getKey(
          progress.guild.id,
          progress.user.id
        ),
        progress
      );
    };

  for (
    const guild
    of bot.guilds.cache.values()
  ) {
    const afkChannelId =
      getConfiguredChannelId(
        'afkfarm',
        guild.id
      );

    if (!afkChannelId) continue;

    for (
      const voiceState
      of guild.voiceStates.cache.values()
    ) {
      const member = voiceState.member;
      const channel = voiceState.channel;

      if (
        !member ||
        member.user?.bot ||
        channel?.id !== afkChannelId
      ) {
        continue;
      }

      const key =
        getKey(guild.id, member.id);

      activeKeys.add(key);

      let progress =
        afkProgress.get(key);

      if (!progress) {
        progress = await loadProgress(
          guild,
          member,
          now
        );

        afkProgress.set(
          key,
          progress
        );
      }

      const elapsed = Math.max(
        0,
        now - progress.lastCheckedAt
      );

      progress.lastCheckedAt = now;
      progress.validMs += elapsed;

      if (!progress.rewardDueAt) {
        const remainingMs = Math.max(
          0,
          progress.targetMs -
            progress.validMs
        );

        progress.rewardDueAt =
          now + remainingMs;
      }

      const statusChanged =
        await updateStatus(
          progress,
          'eligible',
          progress.rewardDueAt
        );

      if (statusChanged) {
        persistImmediately(
          progress
        );
      }

      if (
        progress.validMs >=
          progress.targetMs &&
        !progress.processing
      ) {
        const earnedIntervalMs =
          progress.targetMs;

        const previousValidMs =
          progress.validMs;

        progress.processing = true;

        const nextIntervalMs =
          getRandomAfkInterval();

        try {
          const result =
            await rewardMember(
              member,
              earnedIntervalMs,
              nextIntervalMs
            );

          if (!result) {
            throw new Error(
              'AFK reward account unavailable.'
            );
          }

          progress.validMs = 0;
          progress.targetMs =
            nextIntervalMs;

          progress.rewardDueAt =
            result.nextRewardAt;

          await deleteAfkStatusMessage(
            progress
          );

          progress.suppressEligibleStatus =
            true;
          progress.status =
            'eligible';
          progress.statusRewardDueAt =
            progress.rewardDueAt;

          persistImmediately(
            progress
          );
        } catch (error) {
          progress.validMs =
            previousValidMs;

          console.error(
            'Erreur récompense AFK :',
            error
          );
        } finally {
          progress.processing = false;
        }
      }

      toPersist.push(progress);
    }
  }

  const periodicPersistDue =
    now - lastProgressPersistAt >=
    PROGRESS_PERSIST_INTERVAL_MS;

  const persistEntries =
    periodicPersistDue
      ? toPersist
      : [
          ...immediatePersist.values()
        ];

  if (persistEntries.length) {
    await persistProgressBatch(
      persistEntries
    );
  }

  if (periodicPersistDue) {
    lastProgressPersistAt = now;
  }

  for (
    const [key, progress]
    of afkProgress.entries()
  ) {
    if (activeKeys.has(key)) {
      continue;
    }

    await updateStatus(
      progress,
      'left',
      null
    );

    await AfkRewardProgress.deleteOne({
      userId: progress.user.id,
      guildId: progress.guild.id
    });

    afkProgress.delete(key);
  }
}

async function runTick(bot) {
  if (trackerTickRunning) return;

  trackerTickRunning = true;

  try {
    await tick(bot);
  } finally {
    trackerTickRunning = false;
  }
}

async function startAfkRewardTracker(bot) {
  if (trackerInterval) {
    clearInterval(trackerInterval);
  }

  afkProgress.clear();
  lastProgressPersistAt = 0;

  await cleanupInactiveProgress(bot);

  trackerInterval = setInterval(() => {
    runTick(bot).catch(error => {
      console.error(
        'Erreur tracker récompenses AFK :',
        error
      );
    });
  }, 1000);

  await runTick(bot);

  console.log(
    `Rewards • AFK Farm actif : ${formatDuration(AFK_REWARD_MIN_MS)}-${formatDuration(AFK_REWARD_MAX_MS)} • ${AFK_REWARD_COINS} coins • progression MongoDB`
  );
}

module.exports = {
  getRandomAfkInterval,
  startAfkRewardTracker
};
