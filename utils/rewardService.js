const { EmbedBuilder } = require('discord.js');
const { formatAmount } = require('./formatAmount.js');

const REWARD_CHANNEL_ID = '1547030803303637072';

const MESSAGE_REWARDS = [
  { threshold: 100, coins: 250 },
  { threshold: 500, coins: 1000 },
  { threshold: 1000, coins: 2500 },
  { threshold: 2500, coins: 6000 },
  { threshold: 5000, coins: 15000 },
  { threshold: 10000, coins: 35000 }
];

const VOICE_REWARD_INTERVAL_MS = 15 * 1000;
const VOICE_REWARD_COINS = 1000;

function getReachedMessageReward(messages) {
  const count = Number(messages) || 0;

  return [...MESSAGE_REWARDS]
    .reverse()
    .find(reward => count >= reward.threshold) || null;
}

function buildMessageProgress(messages) {
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

      return (
        `➡️ **${formatAmount(reward.threshold)} messages** ` +
        `— ${formatAmount(reward.coins)} coins ` +
        `(**${formatAmount(remaining)} restants**)`
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
    guild.channels.cache.get(REWARD_CHANNEL_ID) ||
    await guild.channels.fetch(REWARD_CHANNEL_ID)
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
    .setColor(0x6b6de6)
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
  account
}) {
  const channel = await getRewardChannel(guild);
  if (!channel) return false;

  const seconds = Math.floor(
    VOICE_REWARD_INTERVAL_MS / 1000
  );

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🎙️ Récompense vocale')
    .setDescription(
      `${user}, tu as passé **${seconds} secondes valides** en vocal.\n\n` +
      `🪙 **+${formatAmount(VOICE_REWARD_COINS)} coins** dans ta poche.\n` +
      `-# Poche : ${formatAmount(account.coins)} coins\n\n` +
      `⏳ Prochaine récompense dans **${seconds} secondes valides**.`
    )
    .setTimestamp();

  await channel.send({
    content: `${user}`,
    embeds: [embed]
  });

  return true;
}

module.exports = {
  REWARD_CHANNEL_ID,
  MESSAGE_REWARDS,
  VOICE_REWARD_INTERVAL_MS,
  VOICE_REWARD_COINS,
  getReachedMessageReward,
  buildMessageProgress,
  sendMessageRewardNotification,
  sendVoiceRewardNotification
};
