const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildBankTransferLog } = require('../../utils/staffLogs.js');
const parseAmount = require('../../utils/parseAmount.js');
const { moveBalance } = require('../../utils/economyService.js');

module.exports = {
  name: 'ret',
  description: 'Retirez des coins de votre banque vers votre poche.',

  async execute(message, args) {
    const guildId = message.guild.id;
    const amountToWithdraw = parseAmount(args[0]);

    if (!Number.isSafeInteger(amountToWithdraw) || amountToWithdraw <= 0) {
      return message.reply('❓・Veuillez fournir un montant valide à retirer.');
    }

    try {
      const userCoins = await moveBalance({
        userId: message.author.id,
        guildId,
        from: 'bank',
        to: 'coins',
        amount: amountToWithdraw
      });

      if (!userCoins) {
        return message.reply(
          '❌・Vous n\'avez pas assez d\'argent dans la banque pour retirer cette somme.'
        );
      }

      await sendStaffLog(
        message.guild,
        'bank-logs',
        buildBankTransferLog({
          title: '📤 Retrait de la banque',
          user: message.author,
          amount: amountToWithdraw,
          bankBefore: userCoins.bank + amountToWithdraw,
          bankAfter: userCoins.bank,
          pocketBefore: userCoins.coins - amountToWithdraw,
          pocketAfter: userCoins.coins
        })
      );

      return message.reply(
        `🏦・Vous avez retiré **${formatAmount(amountToWithdraw)}** coins de votre banque.`
      );
    } catch (error) {
      console.error('Withdraw error:', error);
      return message.reply(
        'Une erreur s\'est produite lors du retrait des coins.'
      );
    }
  },
};
