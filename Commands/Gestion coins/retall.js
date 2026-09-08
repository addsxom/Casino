const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildBankTransferLog } = require('../../utils/staffLogs.js');
const { moveAllBalance } = require('../../utils/economyService.js');

module.exports = {
  name: 'retall',
  description: 'Retirez tous les coins de votre banque vers votre poche.',

  async execute(message) {
    const guildId = message.guild.id;

    try {
      const movement = await moveAllBalance({
        userId: message.author.id,
        guildId,
        from: 'bank',
        to: 'coins'
      });

      if (!movement) {
        return message.reply('❌・Vous n\'avez pas de coins à retirer.');
      }

      await sendStaffLog(
        message.guild,
        'bank-logs',
        buildBankTransferLog({
          title: '📤 Retrait total de la banque',
          user: message.author,
          amount: movement.amount,
          bankBefore: movement.before.bank,
          bankAfter: movement.after.bank,
          pocketBefore: movement.before.coins,
          pocketAfter: movement.after.coins
        })
      );

      return message.reply(
        `🏦・Vous avez retiré **${formatAmount(movement.amount)}** de votre banque.`
      );
    } catch (error) {
      console.error('Withdraw all error:', error);
      return message.reply(
        'Une erreur s\'est produite lors du retrait des coins.'
      );
    }
  },
};
