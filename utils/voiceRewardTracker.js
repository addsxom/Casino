const {
  VOICE_REWARD_MIN_MS,
  VOICE_REWARD_MAX_MS,
  VOICE_REWARD_COINS,
  formatDuration,
  sendVoiceRewardNotification
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

function isValidVoiceChannel(guild, channel) {
  if (!guild || !channel) return false;
  if (guild.afkChannelId === channel.id) return false;

  const humanCount = channel.members.filter(
    member => !member.user.bot
  ).size;

  return humanCount >= 2;
}

async function rewardMember(
  member,
  earnedIntervalMs,
  nextIntervalMs
) {
  const account = await creditBalance({
    userId: member.id,
    guildId: member.guild.id,
    target: 'coins',
    amount: VOICE_REWARD_COINS
  });

  if (!account) return;

  await sendStaffLog(
    member.guild,
    'economy-logs',
    buildCoinMovementLog({
      title: '🎙️ Récompense vocale',
      user: member.user,
      delta: VOICE_REWARD_COINS,
      pocket: account.coins,
      bank: account.bank,
      reason:
        `${formatDuration(earnedIntervalMs)} valides en vocal`
    })
  );

  await sendVoiceRewardNotification({
    guild: member.guild,
    user: member.user,
    account,
    earnedIntervalMs,
    nextIntervalMs
  }).catch(error => {
    console.error(
      'Erreur notification récompense vocale :',
      error
    );
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
          validMs: 0,
          targetMs: getRandomVoiceInterval(),
          lastCheckedAt: now,
          processing: false
        };
        voiceProgress.set(key, progress);
        continue;
      }

      const elapsed = Math.max(
        0,
        now - progress.lastCheckedAt
      );

      progress.lastCheckedAt = now;

      if (isValidVoiceChannel(guild, channel)) {
        progress.validMs += elapsed;
      }

      if (
        progress.validMs >= progress.targetMs &&
        !progress.processing
      ) {
        const earnedIntervalMs = progress.targetMs;
        progress.validMs -= earnedIntervalMs;
        progress.processing = true;

        const nextIntervalMs =
          getRandomVoiceInterval();

        try {
          await rewardMember(
            member,
            earnedIntervalMs,
            nextIntervalMs
          );
          progress.targetMs = nextIntervalMs;
        } catch (error) {
          progress.validMs += earnedIntervalMs;
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

  for (const key of voiceProgress.keys()) {
    if (!connectedKeys.has(key)) {
      voiceProgress.delete(key);
    }
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
    'Rewards • vocal actif : délai aléatoire 15-20 min'
  );
}

module.exports = {
  startVoiceRewardTracker
};
