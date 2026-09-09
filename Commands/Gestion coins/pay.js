const parseAmount = require('../../utils/parseAmount.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildTransferLog } = require('../../utils/staffLogs.js');
const {
  InsufficientFundsError,
  transferCoins
} = require('../../utils/economyService.js');

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: 'pay',
  description: 'Transférez des coins à un autre utilisateur.',
  usage: 'pay [bank/coins] <montant> <@utilisateur>',

  async execute(message, args) {
    const guildId = message.guild.id;
    const senderId = message.author.id;

    const requestedSource = args[0]?.toLowerCase();
    const hasSource =
      requestedSource === 'bank' ||
      requestedSource === 'coins' ||
      requestedSource === 'poche';

    const source = requestedSource === 'bank'
      ? 'bank'
      : 'coins';

    const amountArg = hasSource ? args[1] : args[0];
    const recipientArg = hasSource ? args[2] : args[1];

    const amount = parseAmount(amountArg);
    const recipient = message.mentions.users.first()
      || message.client.users.cache.get(recipientArg);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return message.reply(
        replyEmbedPayload(
          'Veuillez fournir un montant valide à payer.\n' +
          'Exemples : **+pay 2m @utilisateur** ou **+pay bank 2m @utilisateur**',
          { type: 'error' }
        )
      );
    }

    if (!recipient) {
      return message.reply(replyEmbedPayload('Veuillez mentionner un utilisateur valide.', { type: 'error' }));
    }

    if (recipient.bot) {
      return message.reply(replyEmbedPayload('Tu ne peux pas envoyer de coins à un bot.', { type: 'error' }));
    }

    if (recipient.id === senderId) {
      return message.reply(replyEmbedPayload('Tu ne peux pas te payer toi-même.', { type: 'error' }));
    }

    try {
      const transfer = await transferCoins({
        guildId,
        senderId,
        recipientId: recipient.id,
        source,
        amount
      });

      await sendStaffLog(
        message.guild,
        'transaction-logs',
        buildTransferLog({
          sender: message.author,
          recipient,
          amount,
          source,
          senderBefore: transfer.senderBefore,
          senderAfter: transfer.senderAfter,
          recipientBefore: transfer.recipientBefore,
          recipientAfter: transfer.recipientAfter
        })
      );

      return message.reply(
        replyEmbedPayload(
          `Tu as payé **${formatAmount(amount)}** coins💰 à ${recipient.tag} depuis ${source === 'bank' ? 'ta banque' : 'ta poche'}.`,
          { type: 'success', title: '💸 Paiement effectué' }
        )
      );
    } catch (error) {
      if (
        error instanceof InsufficientFundsError ||
        error?.code === 'INSUFFICIENT_FUNDS'
      ) {
        return message.reply(
          replyEmbedPayload(
            source === 'bank'
              ? 'Tu n\'as pas assez de coins en banque.'
              : 'Tu n\'as pas assez de coins en poche.',
            { type: 'error' }
          )
        );
      }

      console.error('Pay transaction error:', error);
      return message.reply(replyEmbedPayload('Une erreur s\'est produite lors de la transaction.', { type: 'error' }));
    }
  },
};
