const {
  VOICE_REWARD_MIN_MS,
  VOICE_REWARD_MAX_MS,
  VOICE_REWARD_COINS,
  VOICE_ACTIVITY_BONUS_PERCENT,
  VOICE_MUTE_GRACE_MS,
  formatDuration,
  sendVoiceRewardNotification,
  sendOrUpdateVoiceStatus
} = require('./rewardService.js');
const {
  creditBalance
} = require('./economyService.js');
const {
  sendStaffLog,
  buildCoinMovementLog
} = require('./staffLogs.js');

const voiceProgress = new Map();
let trackerInterval = null;

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

function hasEnoughHumans(channel) {
  if (!channel) return false;

  const humanCount = channel.members.filter(
    member => !member.user.bot
  ).size;

  return humanCount >= 2;
}

function resetMuteGrace(progress) {
  progress.mutedSince = null;
  progress.muteWarningSent = false;
}

function resetRewardProgress(progress) {
  progress.validMs = 0;
  progress.targetMs = getRandomVoiceInterval();
  progress.rewardDueAt = null;
}

function getMuteEligibility(
  voiceState,
  progress,
  now
) {
  const selfMuted = voiceState.selfMute === true;
  const selfDeafened = voiceState.selfDeaf === true;

  // Casque coupé uniquement : inéligible immédiatement.
  if (selfDeafened && !selfMuted) {
    resetMuteGrace(progress);

    return {
      eligible: false,
      reason: 'headphones_only'
    };
  }

  // Micro actif : aucune limite mute en cours.
  if (!selfMuted) {
    resetMuteGrace(progress);

    return {
      eligible: true,
      reason: null
    };
  }

  // Micro coupé, avec ou sans casque :
  // reste éligible pendant le délai de grâce.
  if (!progress.mutedSince) {
    progress.mutedSince = now;
  }

  const mutedForMs = Math.max(
    0,
    now - progress.mutedSince
  );

  if (mutedForMs >= VOICE_MUTE_GRACE_MS) {
    return {
      eligible: false,
      reason: 'mute_timeout',
      mutedForMs
    };
  }

  return {
    eligible: true,
    reason: 'mute_grace',
    mutedForMs
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

async function sendMuteTimeoutWarning(member) {
  await member.send(
    '🎙️ **Récompenses vocales mises en pause**\n\n' +
    `Ton micro est coupé depuis **${formatDuration(VOICE_MUTE_GRACE_MS)}**. ` +
    'Pour éviter le farm AFK, ton temps ne compte plus pour les récompenses vocales.\n\n' +
    '✅ **Pour redevenir éligible :** réactive simplement ton micro. ' +
    'Ton compteur de récompense repartira alors de **0** avec un nouveau délai aléatoire.'
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
    target: 'coins',
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
  const forceUpdate =
    progress.status !== status ||
    (
      status === 'eligible' &&
      progress.statusRewardDueAt !== nextRewardAt
    );

  if (!forceUpdate) return;

  progress.status = status;
  progress.statusRewardDueAt =
    status === 'eligible'
      ? nextRewardAt
      : null;

  progress.statusMessage =
    await sendOrUpdateVoiceStatus({
      guild: progress.guild,
      user: progress.user,
      status,
      nextRewardAt,
      message: progress.statusMessage
    }).catch(error => {
      console.error(
        'Erreur statut récompense vocale :',
        error
      );
      return progress.statusMessage;
    });
}

async function tick(bot) {
  const now = Date.now();
  const connectedKeys = new Set();

  for (const guild of bot.guilds.cache.values()) {
    for (const voiceState of guild.voiceStates.cache.values()) {
      const member = voiceState.member;
      const channel = voiceState.channel;

      if (!member || member.user?.bot || !channel) {
        continue;
      }

      const key = getKey(guild.id, member.id);
      connectedKeys.add(key);

      let progress = voiceProgress.get(key);

      if (!progress) {
        progress = {
          guild,
          user: member.user,
          validMs: 0,
          targetMs: getRandomVoiceInterval(),
          rewardDueAt: null,
          lastCheckedAt: now,
          processing: false,
          mutedSince: null,
          muteWarningSent: false,
          previousSelfMute:
            voiceState.selfMute === true,
          status: null,
          statusRewardDueAt: null,
          statusMessage: null
        };

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
        // Demute = nouveau cycle complet.
        resetRewardProgress(progress);
        resetMuteGrace(progress);
        elapsed = 0;
      }

      progress.previousSelfMute = selfMuted;

      const muteEligibility =
        getMuteEligibility(
          voiceState,
          progress,
          now
        );

      if (
        muteEligibility.reason === 'mute_timeout' &&
        !progress.muteWarningSent
      ) {
        progress.muteWarningSent = true;
        await sendMuteTimeoutWarning(member);
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

        const remainingMs = Math.max(
          0,
          progress.targetMs - progress.validMs
        );

        progress.rewardDueAt =
          now + remainingMs;
      } else {
        progress.rewardDueAt = null;
      }

      await updateStatus(
        progress,
        status,
        progress.rewardDueAt
      );

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

          await updateStatus(
            progress,
            'eligible',
            progress.rewardDueAt
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
    }
  }

  for (const [key, progress] of voiceProgress.entries()) {
    if (connectedKeys.has(key)) {
      continue;
    }

    await updateStatus(
      progress,
      'left',
      null
    );

    voiceProgress.delete(key);
  }
}

function startVoiceRewardTracker(bot) {
  if (trackerInterval) {
    clearInterval(trackerInterval);
  }

  voiceProgress.clear();

  trackerInterval = setInterval(() => {
    tick(bot).catch(error => {
      console.error(
        'Erreur tracker récompenses vocales :',
        error
      );
    });
  }, 1000);

  console.log(
    `Rewards • vocal actif : ${formatDuration(VOICE_REWARD_MIN_MS)}-${formatDuration(VOICE_REWARD_MAX_MS)} • mute max ${formatDuration(VOICE_MUTE_GRACE_MS)}`
  );
}

module.exports = {
  startVoiceRewardTracker
};
