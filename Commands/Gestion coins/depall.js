const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildEconomyLog } = require('../../utils/staffLogs.js');
const { moveAllBalance } = require('../../utils/economyService.js');

module.exports = {
  name: 'depall',
  description: 'Déposez tous les coins de votre poche dans votre banque.',

  async execute(message) {
    const guildId = message.guild.id;

    try {
      const movement = await moveAllBalance({
        userId: message.author.id,
        guildId,
        from: 'coins',
        to: 'bank'
      });

      if (!movement) {
        return message.reply('❌・Vous n\'avez pas de coins en poche.');
      }

      await sendStaffLog(
        message.guild,
        'bank-logs',
        buildEconomyLog({
          title: '📥 Dépôt total en banque',
          user: message.author,
          amount: movement.amount,
          pocket: movement.after.coins,
          bank: movement.after.bank,
          sourceChannel: message.channel,
          color: 0x57f287
        })
      );

      return message.reply(
        `🏦・Vous avez déposé **${formatAmount(movement.amount)}** dans votre banque.`
      );
    } catch (error) {
      console.error('Deposit all error:', error);
      return message.reply(
        'Une erreur s\'est produite lors du dépôt des coins.'
      );
    }
  },
};
