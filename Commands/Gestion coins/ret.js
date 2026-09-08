const { EmbedBuilder } = require("discord.js");
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildBankTransferLog } = require('../../utils/staffLogs.js');
const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');

module.exports = {
  name: 'ret',
  description: 'Retirez des coins de votre banque vers votre poche.',
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const amountToWithdraw = parseAmount(args[0]);

      if (isNaN(amountToWithdraw) || amountToWithdraw <= 0) {
        return message.reply('❓・Veuillez fournir un montant valide à retirer.');
      }

      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.bank <= 0) {
        return message.reply('❌・Vous n\'avez pas de coins a retiré.');
      }

      if (!userCoins || userCoins.bank < amountToWithdraw) {
        return message.reply('❌・Vous n\'avez pas assez d\'argent dans la banque pour retirer cette somme.');
      }

      const bankBefore = userCoins.bank;
      const pocketBefore = userCoins.coins;

      userCoins.coins += amountToWithdraw;
      userCoins.bank -= amountToWithdraw;
      await userCoins.save();

      await sendStaffLog(
        message.guild,
        'withdraw-logs',
        buildBankTransferLog({
          title: '📤 Retrait de la banque',
          user: message.author,
          amount: amountToWithdraw,
          bankBefore,
          bankAfter: userCoins.bank,
          pocketBefore,
          pocketAfter: userCoins.coins
        })
      );

      return message.reply(`🏦・Vous avez retiré **${formatAmount(amountToWithdraw)}** coins de votre banque.`)

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du retrait des coins.');
    }
  },
};
