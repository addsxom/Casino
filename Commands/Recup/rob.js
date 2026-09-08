const { EmbedBuilder } = require("discord.js");
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');
const { InsufficientFundsError, getAccount, transferCoins } = require('../../utils/economyService.js');

module.exports = {
  name: 'rob',
  description: 'Volez des coins à un utilisateur.',
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const targetUser = message.mentions.users.first() || message.client.users.cache.get(args[0]);

      if (!targetUser) {
        return message.reply('Veuillez mentionner un utilisateur à rob.');
      }

      if (targetUser.bot) {
        return message.reply('Tu ne peux pas voler un bot.');
      }

      if (targetUser.id === message.author.id) {
        return message.reply('Tu ne peux pas te voler toi-même.');
      }

      const targetCoins = await getAccount(targetUser.id, guildId);

      const robberyChance = Math.random();
      let stolenCoins = 0;
      let transfer = null;

      if (
        robberyChance <= 0.5 &&
        targetCoins &&
        targetCoins.coins > 0
      ) {
        stolenCoins = Math.floor(
          targetCoins.coins * (Math.random() * 0.5)
        );

        if (stolenCoins > 0) {
          try {
            transfer = await transferCoins({
              guildId,
              senderId: targetUser.id,
              recipientId: message.author.id,
              source: 'coins',
              amount: stolenCoins
            });
          } catch (error) {
            if (
              error instanceof InsufficientFundsError ||
              error?.code === 'INSUFFICIENT_FUNDS'
            ) {
              stolenCoins = 0;
            } else {
              throw error;
            }
          }
        }
      }

      if (transfer && stolenCoins > 0) {
        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🦹 Vol réussi',
            user: message.author,
            delta: stolenCoins,
            pocket: transfer.recipientDocument.coins,
            bank: transfer.recipientDocument.bank,
            reason: '+rob',
            sourceChannel: message.channel,
            otherUser: targetUser
          })
        );

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '💸 Coins volés',
            user: targetUser,
            delta: -stolenCoins,
            pocket: transfer.senderDocument.coins,
            bank: transfer.senderDocument.bank,
            reason: '+rob',
            sourceChannel: message.channel,
            otherUser: message.author
          })
        );
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
        .setDescription(stolenCoins > 0
          ? `💰・Vous avez volé **${formatAmount(stolenCoins)}** coins à ${targetUser.tag}.`
          : `❌・Vous n'avez pas réussi à voler ${targetUser.tag}`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors de la tentative de vol.');
    }
  },
};
