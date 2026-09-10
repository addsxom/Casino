const { EmbedBuilder } = require("discord.js");
const UserWorkCooldown = require('../../Models/UserWorkCooldown.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');
const { creditBalance } = require('../../utils/economyService.js');
const { tryAcquireCooldown, releaseCooldown } = require('../../utils/cooldownService.js');

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: 'work',
  aliases: ['wk'],
  description: 'Gagnez des coins en travaillant.',
  async execute(message) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    try {

      const cooldown = await tryAcquireCooldown(
        UserWorkCooldown,
        {
          userId,
          guildId,
          durationMs: 60 * 60 * 1000
        }
      );

      if (!cooldown.acquired) {
        const availableAtUnix =
          Math.floor(
            cooldown.availableAt /
            1000
          );

        const cooldownEmbed = new EmbedBuilder()
          .setTitle('Vous avez déjà work récemment')
          .setDescription(`⏳・Disponible <t:${availableAtUnix}:R>`)
          .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
          .setColor(0xFF0000);

        return message.reply({ embeds: [cooldownEmbed] });
      }

      const coinsEarned = Math.floor(Math.random() * (1000 - 15 + 1)) + 15;

      let userCoins;

      try {
        userCoins = await creditBalance({
          userId,
          guildId,
          target: 'coins',
          amount: coinsEarned
        });
      } catch (error) {
        await releaseCooldown(
          UserWorkCooldown,
          {
            userId,
            guildId,
            availableAt: cooldown.availableAt
          }
        );

        throw error;
      }

      await sendStaffLog(
        message.guild,
        'economy-logs',
        buildCoinMovementLog({
          title: '💼 Récompense de travail',
          user: message.author,
          delta: coinsEarned,
          pocket: userCoins.coins,
          bank: userCoins.bank,
          reason: '+work / +wk',
          sourceChannel: message.channel
        })
      );

      const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true })})
        .setDescription(`💰・Vous avez gagné ${formatAmount(coinsEarned)} coins`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply(replyEmbedPayload('Une erreur s\'est produite lors de la récupération des coins.', { type: 'error' }));
    }
  },
};

