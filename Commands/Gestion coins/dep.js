const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildEconomyLog } = require('../../utils/staffLogs.js');
const parseAmount = require('../../utils/parseAmount.js');
const { moveBalance } = require('../../utils/economyService.js');

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: 'dep',
  description: 'Déposez des coins dans votre banque.',

  async execute(message, args) {
    const guildId = message.guild.id;
    const amountToDeposit = parseAmount(args[0]);

    if (!Number.isSafeInteger(amountToDeposit) || amountToDeposit <= 0) {
      return message.reply(replyEmbedPayload('Veuillez fournir un montant valide à déposer.', { type: 'error' }));
    }

    try {
      const userCoins = await moveBalance({
        userId: message.author.id,
        guildId,
        from: 'coins',
        to: 'bank',
        amount: amountToDeposit
      });

      if (!userCoins) {
        return message.reply(
          replyEmbedPayload(
            'Vous n\'avez pas assez de coins pour déposer cette somme.',
            { type: 'error' }
          )
        );
      }

      await sendStaffLog(
        message.guild,
        'bank-logs',
        buildEconomyLog({
          title: '📥 Dépôt en banque',
          user: message.author,
          amount: amountToDeposit,
          pocket: userCoins.coins,
          bank: userCoins.bank,
          sourceChannel: message.channel,
          color: 0x57f287
        })
      );

      return message.reply(
        replyEmbedPayload(
          `Vous avez déposé **${formatAmount(amountToDeposit)}** coins dans votre banque.`,
          { type: 'success', title: '🏦 Dépôt effectué' }
        )
      );
    } catch (error) {
      console.error('Deposit error:', error);
      return message.reply(
        replyEmbedPayload(
          'Une erreur s\'est produite lors du dépôt des coins.',
          { type: 'error' }
        )
      );
    }
  },
};
