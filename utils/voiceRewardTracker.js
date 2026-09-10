const VoiceRewardProgress =
  require('../Models/VoiceRewardProgress.js');
const config = require('../config/botConfig.js');
const {
  getConfiguredChannelId,
  getConfiguredChannelIds
} = require('./configService.js');
const {
  VOICE_REWARD_MIN_MS,
  VOICE_REWARD_MAX_MS,
  VOICE_REWARD_COINS,
  VOICE_ACTIVITY_BONUS_PERCENT,
  VOICE_MUTE_GRACE_REWARDS,
  formatDuration,
  sendVoiceRewardNotification,
  sendOrUpdateVoiceStatus,
  deleteRewardStatusMessage
} = require('./rewardService.js');
const {
  creditBalance
} = require('./economyService.js');
const {
  sendStaffLog,
  buildCoinMovementLog
} = require('./staffLogs.js');
const { replyEmbedPayload } = require('./replyEmbed.js');

const voiceProgress = new Map();
let trackerInterval = null;
let trackerTickRunning = false;
let lastProgressPersistAt = 0;

const PROGRESS_PERSIST_INTERVAL_MS =
  config.system.progressPersistIntervalMs ||
  15 * 1000;

function getKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getRandomVoiceInterval() {
  return Math.floor(
    VOICE_REWARD_MIN_MS +
    Math.random() *
      (VOICE_REWARD_MAX_MS - VOICE_REWARD_MIN_MS + 1)
  );
}

function normalizeTargetMs(value) {
  const target = Number(value);

  if (
    !Number.isFinite(target) ||
    target < VOICE_REWARD_MIN_MS ||
    target > VOICE_REWARD_MAX_MS
  ) {
    return getRandomVoiceInterval();
  }

  return Math.floor(target);
}

function normalizeProgressMs(value, max) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.min(
    Math.floor(number),
    Math.max(0, max)
  );
}

function hasEnoughHumans(channel) {
  if (!channel) return false;

  const humanCount = channel.members.filter(
    member => !member.user.bot
  ).size;

  return humanCount >= config.rewards.voice.minimumHumans;
}

function isVoiceFarmChannel(
  guild,
  channel
) {
  if (!guild || !channel) {
    return false;
  }

  const afkChannelId =
    getConfiguredChannelId(
      'afkfarm',
      guild.id
    );

  if (channel.id === afkChannelId) {
    return false;
  }

  const configuredFarmIds =
    getConfiguredChannelIds(
      'voicefarm',
      guild.id
    );

  if (!configuredFarmIds.length) {
    return true;
  }

  return configuredFarmIds.includes(
    channel.id
  );
}


function resetMuteGrace(progress) {
  progress.mutedRewards = 0;
  progress.muteWarningSent = false;
}

function resetRewardProgress(progress) {
  progress.validMs = 0;
  progress.targetMs = getRandomVoiceInterval();
  progress.rewardDueAt = null;
  progress.suppressEligibleStatus = false;
}

function getMuteEligibility(
  voiceState,
  progress
) {
  const selfMuted = voiceState.selfMute === true;
  const selfDeafened = voiceState.selfDeaf === true;

  if (selfDeafened && !selfMuted) {
    resetMuteGrace(progress);

    return {
      eligible: false,
      reason: 'headphones_only'
    };
  }

  if (!selfMuted) {
    resetMuteGrace(progress);

    return {
      eligible: true,
      reason: null
    };
  }

  if (
    progress.mutedRewards >=
    VOICE_MUTE_GRACE_REWARDS
  ) {
    return {
      eligible: false,
      reason: 'mute_reward_limit',
      mutedRewards:
        progress.mutedRewards
    };
  }

  return {
    eligible: true,
    reason: 'mute_grace',
    mutedRewards:
      progress.mutedRewards,
    rewardsRemaining:
      VOICE_MUTE_GRACE_REWARDS -
      progress.mutedRewards
  };
}

function getEligibilityStatus({
  enoughHumans,
  muteEligibility
}) {
  if (!enoughHumans) {
    return 'waiting_humans';
  }

  if (!muteEligibility.eligible) {
    return muteEligibility.reason;
  }

  return 'eligible';
}

async function sendMuteRewardLimitWarning(member) {
  await member.send(
    replyEmbedPayload(
      `Tu as reçu **${VOICE_MUTE_GRACE_REWARDS} récompenses vocales** avec le micro coupé. ` +
      'Tu n’es désormais plus éligible tant que ton micro reste coupé.\n\n' +
      '**Pour redevenir éligible :** réactive simplement ton micro. ' +
      `La limite repartira alors à **0/${VOICE_MUTE_GRACE_REWARDS}** et ton compteur de récompense repartira avec un nouveau délai aléatoire.`,
      {
        type: 'warning',
        title: '🎙️ Récompenses vocales en pause'
      }
    )
  ).catch(() => {});
}

function getActivityBonus(voiceState) {
  const hasStream = voiceState.streaming === true;
  const hasCamera = voiceState.selfVideo === true;

  if (!hasStream && !hasCamera) {
    return {
      bonusPercent: 0,
      bonusCoins: 0,
      activityLabel: null
    };
  }

  const bonusCoins = Math.floor(
    VOICE_REWARD_COINS *
      (VOICE_ACTIVITY_BONUS_PERCENT / 100)
  );

  let activityLabel = 'Caméra';

  if (hasStream && hasCamera) {
    activityLabel = 'Caméra + stream';
  } else if (hasStream) {
    activityLabel = 'Stream';
  }

  return {
    bonusPercent: VOICE_ACTIVITY_BONUS_PERCENT,
    bonusCoins,
    activityLabel
  };
}

async function rewardMember(
  member,
  voiceState,
  earnedIntervalMs,
  nextIntervalMs
) {
  const {
    bonusPercent,
    bonusCoins,
    activityLabel
  } = getActivityBonus(voiceState);

  const totalCoins =
    VOICE_REWARD_COINS + bonusCoins;

  const account = await creditBalance({
    userId: member.id,
    guildId: member.guild.id,
    target: 'bank',
    amount: totalCoins
  });

  if (!account) return null;

  const nextRewardAt =
    Date.now() + nextIntervalMs;

  await sendStaffLog(
    member.guild,
    'economy-logs',
    buildCoinMovementLog({
      title: '🎙️ Récompense vocale',
      user: member.user,
      delta: totalCoins,
      pocket: account.coins,
      bank: account.bank,
      reason:
        `${formatDuration(earnedIntervalMs)} valides en vocal`,
      details: bonusCoins > 0
        ? `Bonus ${activityLabel} : +${bonusPercent}% (+${bonusCoins} coins)`
        : null
    })
  );

  await sendVoiceRewardNotification({
    guild: member.guild,
    user: member.user,
    account,
    earnedIntervalMs,
    nextIntervalMs,
    nextRewardAt,
    baseCoins: VOICE_REWARD_COINS,
    bonusCoins,
    bonusPercent,
    activityLabel
  }).catch(error => {
    console.error(
      'Erreur notification récompense vocale :',
      error
    );
  });

  return {
    nextRewardAt
  };
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
      progress.statusRewardDueAt !== nextRewardAt
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
    await sendOrUpdateVoiceStatus({
      guild: progress.guild,
      user: progress.user,
      status,
      nextRewardAt,
      message: progress.statusMessage,
      messageId:
        progress.statusMessageId
    }).catch(error => {
      console.error(
        'Erreur statut récompense vocale :',
        error
      );
      return progress.statusMessage;
    });

  progress.statusMessageId =
    progress.statusMessage?.id ||
    null;

  return true;
}

async function deleteVoiceStatusMessage(
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

async function loadProgress(
  guild,
  member,
  voiceState,
  now
) {
  const saved =
    await VoiceRewardProgress.findOne({
      userId: member.id,
      guildId: guild.id
    }).lean();

  let targetMs = normalizeTargetMs(
    saved?.targetMs
  );

  let validMs = normalizeProgressMs(
    saved?.validMs,
    targetMs
  );

  let mutedRewards =
    Math.min(
      VOICE_MUTE_GRACE_REWARDS,
      Math.max(
        0,
        Math.floor(
          Number(
            saved?.mutedRewards
          ) || 0
        )
      )
    );

  const currentSelfMute =
    voiceState.selfMute === true;

  if (
    saved?.previousSelfMute === true &&
    currentSelfMute === false
  ) {
    validMs = 0;
    targetMs = getRandomVoiceInterval();
    mutedRewards = 0;
  }

  return {
    guild,
    user: member.user,
    validMs,
    targetMs,
    mutedRewards,
    rewardDueAt: null,
    lastCheckedAt: now,
    processing: false,
    muteWarningSent: false,
    previousSelfMute:
      voiceState.selfMute === true,
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

  const operations = entries.map(progress => ({
    updateOne: {
      filter: {
        userId: progress.user.id,
        guildId: progress.guild.id
      },
      update: {
        $set: {
          validMs: Math.floor(progress.validMs),
          targetMs: Math.floor(progress.targetMs),
          mutedRewards:
            Math.floor(
              progress.mutedRewards
            ),
          previousSelfMute:
            progress.previousSelfMute === true,
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

  await VoiceRewardProgress.bulkWrite(
    operations,
    { ordered: false }
  );
}

async function normalizeDisconnectedProgress(
  bot
) {
  const saved =
    await VoiceRewardProgress.find({})
      .lean();

  if (!saved.length) return;

  const connectedKeys = new Set();

  for (const guild of bot.guilds.cache.values()) {
    for (
      const voiceState
      of guild.voiceStates.cache.values()
    ) {
      const member = voiceState.member;
      const channel = voiceState.channel;

      if (
        member &&
        !member.user?.bot &&
        channel &&
        isVoiceFarmChannel(
          guild,
          channel
        )
      ) {
        connectedKeys.add(
          getKey(guild.id, member.id)
        );
      }
    }
  }

  for (const entry of saved) {
    if (
      connectedKeys.has(
        getKey(
          entry.guildId,
          entry.userId
        )
      )
    ) {
      continue;
    }

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

    await VoiceRewardProgress
      .updateOne(
        { _id: entry._id },
        {
          $set: {
            validMs: 0,
            targetMs:
              getRandomVoiceInterval(),
            statusMessageId: null,
            suppressEligibleStatus:
              false
          }
        }
      );
  }
}

async function tick(bot) {
  const now = Date.now();
  const connectedKeys = new Set();
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

  for (const guild of bot.guilds.cache.values()) {
    for (const voiceState of guild.voiceStates.cache.values()) {
      const member = voiceState.member;
      const channel = voiceState.channel;

      if (
        !member ||
        member.user?.bot ||
        !channel ||
        !isVoiceFarmChannel(
          guild,
          channel
        )
      ) {
        continue;
      }

      const key = getKey(guild.id, member.id);
      connectedKeys.add(key);

      let progress = voiceProgress.get(key);

      if (!progress) {
        progress = await loadProgress(
          guild,
          member,
          voiceState,
          now
        );

        voiceProgress.set(key, progress);
      }

      let elapsed = Math.max(
        0,
        now - progress.lastCheckedAt
      );

      progress.lastCheckedAt = now;

      const selfMuted =
        voiceState.selfMute === true;

      const justUnmuted =
        progress.previousSelfMute === true &&
        selfMuted === false;

      if (justUnmuted) {
        resetRewardProgress(progress);
        resetMuteGrace(progress);
        elapsed = 0;
        persistImmediately(
          progress
        );
      }

      progress.previousSelfMute = selfMuted;

      const muteEligibility =
        getMuteEligibility(
          voiceState,
          progress
        );

      if (
        muteEligibility.reason === 'mute_reward_limit' &&
        !progress.muteWarningSent
      ) {
        progress.muteWarningSent = true;
        await sendMuteRewardLimitWarning(member);
      }

      const enoughHumans =
        hasEnoughHumans(channel);

      const eligible =
        enoughHumans &&
        muteEligibility.eligible;

      const status =
        getEligibilityStatus({
          enoughHumans,
          muteEligibility
        });

      if (eligible) {
        progress.validMs += elapsed;

        if (!progress.rewardDueAt) {
          const remainingMs = Math.max(
            0,
            progress.targetMs - progress.validMs
          );

          progress.rewardDueAt =
            now + remainingMs;
        }
      } else {
        progress.rewardDueAt = null;
      }

      const statusChanged =
        await updateStatus(
          progress,
          status,
          progress.rewardDueAt
        );

      if (statusChanged) {
        persistImmediately(
          progress
        );
      }

      if (
        eligible &&
        progress.validMs >= progress.targetMs &&
        !progress.processing
      ) {
        const earnedIntervalMs =
          progress.targetMs;

        const previousValidMs =
          progress.validMs;

        progress.processing = true;

        const nextIntervalMs =
          getRandomVoiceInterval();

        try {
          const rewardResult =
            await rewardMember(
              member,
              voiceState,
              earnedIntervalMs,
              nextIntervalMs
            );

          if (!rewardResult) {
            throw new Error(
              'Voice reward account unavailable.'
            );
          }

          progress.validMs = 0;
          progress.targetMs = nextIntervalMs;
          progress.rewardDueAt =
            rewardResult.nextRewardAt;

          await deleteVoiceStatusMessage(
            progress
          );

          progress.suppressEligibleStatus =
            true;

          if (selfMuted) {
            progress.mutedRewards =
              Math.min(
                VOICE_MUTE_GRACE_REWARDS,
                progress.mutedRewards + 1
              );
          }

          const postRewardMuteEligibility =
            getMuteEligibility(
              voiceState,
              progress
            );

          if (
            !postRewardMuteEligibility
              .eligible
          ) {
            progress.rewardDueAt = null;

            if (
              postRewardMuteEligibility
                .reason ===
                'mute_reward_limit' &&
              !progress.muteWarningSent
            ) {
              progress.muteWarningSent = true;

              await sendMuteRewardLimitWarning(
                member
              );
            }

            await updateStatus(
              progress,
              postRewardMuteEligibility
                .reason,
              null
            );
          } else {
            progress.status =
              'eligible';
            progress.statusRewardDueAt =
              progress.rewardDueAt;
          }

          persistImmediately(
            progress
          );
        } catch (error) {
          progress.validMs = previousValidMs;

          console.error(
            'Erreur récompense vocale :',
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
    of voiceProgress.entries()
  ) {
    if (connectedKeys.has(key)) {
      continue;
    }

    await updateStatus(
      progress,
      'left',
      null
    );

    resetRewardProgress(
      progress
    );

    progress.statusMessage = null;
    progress.statusMessageId = null;
    progress.status = null;
    progress.statusRewardDueAt = null;
    progress.lastCheckedAt = now;

    await persistProgressBatch([
      progress
    ]);

    voiceProgress.delete(key);
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

async function startVoiceRewardTracker(bot) {
  if (trackerInterval) {
    clearInterval(trackerInterval);
  }

  voiceProgress.clear();
  lastProgressPersistAt = 0;

  await normalizeDisconnectedProgress(bot);

  trackerInterval = setInterval(() => {
    runTick(bot).catch(error => {
      console.error(
        'Erreur tracker récompenses vocales :',
        error
      );
    });
  }, 1000);

  await runTick(bot);

  console.log(
    `Rewards • vocal actif : ${formatDuration(VOICE_REWARD_MIN_MS)}-${formatDuration(VOICE_REWARD_MAX_MS)} • mute max ${VOICE_MUTE_GRACE_REWARDS} récompenses • progression MongoDB`
  );
}

module.exports = {
  startVoiceRewardTracker
};
