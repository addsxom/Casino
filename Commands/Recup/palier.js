const { EmbedBuilder } = require('discord.js');
const { getAccount } = require('../../utils/economyService.js');
const {
  MESSAGE_REWARDS,
  buildMessageProgress
} = require('../../utils/rewardService.js');
const { formatAmount } = require('../../utils/formatAmount.js');

module.exports = {
  name: 'palier',
  aliases: ['paliers'],
  description: 'Affiche votre progression des paliers de messages.',

  async execute(message) {
    if (!message.guild) return;

    const account = await getAccount(
      message.author.id,
      message.guild.id
    );

    const messages = Number(account?.messages) || 0;
    const nextReward = MESSAGE_REWARDS.find(
      reward => messages < reward.threshold
    );

    let nextText =
      '🏆 **Tous les paliers sont terminés !**';

    if (nextReward) {
      const remaining = Math.max(
        0,
        nextReward.threshold - messages
      );

      nextText =
        `➡️ **Prochain palier : ${formatAmount(nextReward.threshold)} messages**\n` +
        `🎁 Récompense : **${formatAmount(nextReward.coins)} coins**\n` +
        `💬 Il te reste **${formatAmount(remaining)} messages** à envoyer.`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x6b6de6)
      .setTitle('💬 Paliers de messages')
      .setDescription(
        `${message.author}\n\n` +
        `📨 Messages comptabilisés : **${formatAmount(messages)}**\n\n` +
        nextText
      )
      .addFields({
        name: '📊 Progression',
        value: buildMessageProgress(
          messages,
          { showRemaining: true }
        )
      })
      .setFooter({
        text: 'Seuls les messages d’au moins 3 caractères comptent.'
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }
};
