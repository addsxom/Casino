const {
  VOICE_REWARD_INTERVAL_MS,
  VOICE_REWARD_COINS,
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

function isValidVoiceChannel(guild, channel) {
  if (!guild || !channel) return false;
  if (guild.afkChannelId === channel.id) return false;

  const humanCount = channel.members.filter(
    member => !member.user.bot
  ).size;

  return humanCount >= 2;
}

async function rewardMember(member) {
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
        `${VOICE_REWARD_INTERVAL_MS / 1000} secondes valides en vocal`
    })
  );

  await sendVoiceRewardNotification({
    guild: member.guild,
    user: member.user,
    account
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
        progress.validMs >= VOICE_REWARD_INTERVAL_MS &&
        !progress.processing
      ) {
        progress.validMs -= VOICE_REWARD_INTERVAL_MS;
        progress.processing = true;

        try {
          await rewardMember(member);
        } catch (error) {
          progress.validMs += VOICE_REWARD_INTERVAL_MS;
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
    `Rewards • vocal test actif : ${VOICE_REWARD_INTERVAL_MS / 1000}s`
  );
}

module.exports = {
  startVoiceRewardTracker
};
