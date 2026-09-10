const { EmbedBuilder } = require('discord.js');
const config = require('../config/botConfig.js');
const { getConfiguredChannelId } = require('./configService.js');
const { formatAmount } = require('./formatAmount.js');

const MESSAGE_REWARDS =
  config.rewards.messages.milestones;
const VOICE_REWARD_MIN_MS =
  config.rewards.voice.rewardMinMs;
const VOICE_REWARD_MAX_MS =
  config.rewards.voice.rewardMaxMs;
const VOICE_REWARD_COINS =
  config.rewards.voice.rewardCoins;
const VOICE_ACTIVITY_BONUS_PERCENT =
  config.rewards.voice.activityBonusPercent;
const VOICE_MUTE_GRACE_REWARDS =
  config.rewards.voice.muteGraceRewards;
const AFK_REWARD_MIN_MS =
  config.rewards.afk.rewardMinMs;
const AFK_REWARD_MAX_MS =
  config.rewards.afk.rewardMaxMs;
const AFK_REWARD_COINS =
  config.rewards.afk.rewardCoins;

function formatDuration(ms) {
  const totalSeconds = Math.max(
    0,
    Math.round(ms / 1000)
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (seconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${seconds}s`;
}

function formatDiscordTimestamp(timestampMs) {
  const unix = Math.floor(
    Number(timestampMs) / 1000
  );

  return `<t:${unix}:R> • <t:${unix}:T>`;
}

function buildVoiceStatusEmbed({
  user,
  status,
  nextRewardAt
}) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTimestamp();

  if (status === 'waiting_humans') {
    return embed
      .setTitle('👥 Récompense vocale en attente')
      .setDescription(
        `${user}, il faut au minimum **${config.rewards.voice.minimumHumans} humains** dans le vocal pour que ton compteur avance.\n\n` +
        `⏸️ Ton temps de récompense est en pause. Le timer démarrera automatiquement dès que vous serez au moins ${config.rewards.voice.minimumHumans}.`
      );
  }

  if (status === 'headphones_only') {
    return embed
      .setColor(0xed4245)
      .setTitle('🎧 Récompense vocale en pause')
      .setDescription(
        `${user}, ton casque est coupé alors que ton micro est actif.\n\n` +
        '⏸️ Tu n’es pas éligible dans cet état. Réactive ton casque pour reprendre le compteur.'
      );
  }

  if (status === 'mute_reward_limit') {
    return embed
      .setColor(0xed4245)
      .setTitle('🔇 Récompense vocale en pause')
      .setDescription(
        `${user}, tu as déjà reçu **${VOICE_MUTE_GRACE_REWARDS} récompenses** avec le micro coupé.\n\n` +
        '⏸️ Tu n’es plus éligible dans cet état. Réactive ton micro pour repartir à **0/' +
        VOICE_MUTE_GRACE_REWARDS +
        '**.'
      );
  }

  if (status === 'left') {
    return embed
      .setColor(0xed4245)
      .setTitle('👋 Session vocale terminée')
      .setDescription(
        `${user}, tu as quitté le vocal.\n\n` +
        '⏹️ Le compteur de récompense a été arrêté.'
      );
  }

  return embed
    .setColor(0xfee75c)
    .setTitle('🎙️ Compteur vocal actif')
    .setDescription(
      `${user}, ton compteur de récompense vocale est actif.\n\n` +
      `🎁 **Prochaine récompense :** ${formatDiscordTimestamp(nextRewardAt)}\n` +
      '-# Le timestamp reste exact tant que tu restes éligible.'
    );
}

async function sendOrUpdateVoiceStatus({
  guild,
  user,
  status,
  nextRewardAt = null,
  message = null
}) {
  const channel = await getRewardChannel(guild);
  if (!channel) return null;

  const embed = buildVoiceStatusEmbed({
    user,
    status,
    nextRewardAt
  });

  if (message?.editable) {
    const edited = await message.edit({
      content: null,
      embeds: [embed]
    }).catch(() => null);

    if (edited) return edited;
  }

  return channel.send({
    embeds: [embed]
  });
}

function buildAfkStatusEmbed({
  user,
  status,
  nextRewardAt
}) {
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTimestamp();

  if (status === 'left') {
    return embed
      .setColor(0xed4245)
      .setTitle('🛌 Session AFK terminée')
      .setDescription(
        `${user}, tu as quitté **AFK Farm**.\n\n` +
        '⏹️ Le compteur de récompense AFK a été arrêté.'
      );
  }

  return embed
    .setColor(0xfee75c)
    .setTitle('🛌 Compteur AFK actif')
    .setDescription(
      `${user}, ton compteur **AFK Farm** est actif.\n\n` +
      `🎁 **Prochaine récompense :** ${formatDiscordTimestamp(nextRewardAt)}\n` +
      '-# Micro/casque mute autorisés : rester dans AFK Farm suffit.'
    );
}

async function sendOrUpdateAfkStatus({
  guild,
  user,
  status,
  nextRewardAt = null,
  message = null
}) {
  const channel = await getRewardChannel(guild);
  if (!channel) return null;

  const embed = buildAfkStatusEmbed({
    user,
    status,
    nextRewardAt
  });

  if (message?.editable) {
    const edited = await message.edit({
      content: `${user}`,
      embeds: [embed]
    }).catch(() => null);

    if (edited) return edited;
  }

  return channel.send({
    content: `${user}`,
    embeds: [embed]
  });
}

async function sendAfkRewardNotification({
  guild,
  user,
  account,
  earnedIntervalMs,
  nextRewardAt,
  coins
}) {
  const channel = await getRewardChannel(guild);
  if (!channel) return false;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🛌 Récompense AFK Farm')
    .setDescription(
      `${user}, tu as passé **${formatDuration(earnedIntervalMs)}** dans **AFK Farm**.\n\n` +
      `🪙 **+${formatAmount(coins)} coins** dans ta poche.\n` +
      `-# Poche : ${formatAmount(account.coins)} coins\n\n` +
      `🎲 **Prochaine récompense :** ${formatDiscordTimestamp(nextRewardAt)}\n` +
      '-# Aucun état micro/casque ne bloque les récompenses AFK.'
    )
    .setTimestamp();

  await channel.send({
    content: `${user}`,
    embeds: [embed]
  });

  return true;
}

function getReachedMessageReward(messages) {
  const count = Number(messages) || 0;

  return [...MESSAGE_REWARDS]
    .reverse()
    .find(reward => count >= reward.threshold) || null;
}

function buildMessageProgress(
  messages,
  { showRemaining = false } = {}
) {
  const count = Number(messages) || 0;
  const nextReward = MESSAGE_REWARDS.find(
    reward => count < reward.threshold
  );

  const lines = MESSAGE_REWARDS.map(reward => {
    if (count >= reward.threshold) {
      return (
        `✅ **${formatAmount(reward.threshold)} messages** ` +
        `— ${formatAmount(reward.coins)} coins`
      );
    }

    if (
      nextReward &&
      reward.threshold === nextReward.threshold
    ) {
      const remaining = Math.max(
        0,
        reward.threshold - count
      );

      const remainingText = showRemaining
        ? ` (**${formatAmount(remaining)} restants**)`
        : '';

      return (
        `➡️ **${formatAmount(reward.threshold)} messages** ` +
        `— ${formatAmount(reward.coins)} coins` +
        remainingText
      );
    }

    return (
      `⬜ **${formatAmount(reward.threshold)} messages** ` +
      `— ${formatAmount(reward.coins)} coins`
    );
  });

  if (!nextReward) {
    lines.push(
      '\n🏆 **Tous les paliers de messages sont terminés !**'
    );
  }

  return lines.join('\n');
}

async function getRewardChannel(guild) {
  if (!guild) return null;

  let channel =
    guild.channels.cache.get(getConfiguredChannelId('rewards', guild.id)) ||
    await guild.channels.fetch(getConfiguredChannelId('rewards', guild.id))
      .catch(() => null);

  return channel?.isTextBased?.()
    ? channel
    : null;
}

async function sendMessageRewardNotification({
  guild,
  user,
  reward,
  account
}) {
  const channel = await getRewardChannel(guild);
  if (!channel) return false;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('💬 Palier de messages atteint !')
    .setDescription(
      `${user}, tu as atteint **${formatAmount(reward.threshold)} messages** !\n\n` +
      `🏦 **+${formatAmount(reward.coins)} coins** dans ta banque.\n` +
      `-# Banque : ${formatAmount(account.bank)} coins`
    )
    .addFields({
      name: '📊 Progression des paliers',
      value: buildMessageProgress(account.messages)
    })
    .setTimestamp();

  await channel.send({
    content: `${user}`,
    embeds: [embed]
  });

  return true;
}

async function sendVoiceRewardNotification({
  guild,
  user,
  account,
  earnedIntervalMs,
  nextIntervalMs,
  nextRewardAt,
  baseCoins,
  bonusCoins,
  bonusPercent,
  activityLabel
}) {
  const channel = await getRewardChannel(guild);
  if (!channel) return false;

  const totalCoins =
    (Number(baseCoins) || 0) +
    (Number(bonusCoins) || 0);

  let rewardDetails =
    `🪙 **+${formatAmount(totalCoins)} coins** dans ta poche.`;

  if (bonusCoins > 0) {
    rewardDetails +=
      `\n📹 **Bonus activité : +${bonusPercent}%** ` +
      `(+${formatAmount(bonusCoins)} coins) ` +
      `— ${activityLabel}`;
  }

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🎙️ Récompense vocale')
    .setDescription(
      `${user}, tu as passé **${formatDuration(earnedIntervalMs)} valides** en vocal.\n\n` +
      rewardDetails +
      `\n-# Poche : ${formatAmount(account.coins)} coins\n\n` +
      `🎲 **Prochaine récompense :** ${formatDiscordTimestamp(nextRewardAt)}`
    )
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  });

  return true;
}

module.exports = {
  MESSAGE_REWARDS,
  VOICE_REWARD_MIN_MS,
  VOICE_REWARD_MAX_MS,
  VOICE_REWARD_COINS,
  VOICE_ACTIVITY_BONUS_PERCENT,
  VOICE_MUTE_GRACE_REWARDS,
  AFK_REWARD_MIN_MS,
  AFK_REWARD_MAX_MS,
  AFK_REWARD_COINS,
  formatDuration,
  formatDiscordTimestamp,
  getReachedMessageReward,
  buildMessageProgress,
  sendMessageRewardNotification,
  sendVoiceRewardNotification,
  sendOrUpdateVoiceStatus,
  sendAfkRewardNotification,
  sendOrUpdateAfkStatus
};
