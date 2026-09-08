const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildTransferLog } = require('../../utils/staffLogs.js');

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

    try {
      if (isNaN(amount) || amount <= 0) {
        return message.reply(
          'Veuillez fournir un montant valide à payer.\n' +
          'Exemples : **+pay 2m @utilisateur** ou **+pay bank 2m @utilisateur**'
        );
      }

      if (!recipient) {
        return message.reply('Veuillez mentionner un utilisateur valide.');
      }

      if (recipient.bot) {
        return message.reply('Tu ne peux pas envoyer de coins à un bot.');
      }

      if (recipient.id === senderId) {
        return message.reply('Tu ne peux pas te payer toi-même.');
      }

      const senderCoins = await UserCoins.findOne({
        userId: senderId,
        guildId
      });

      if (!senderCoins || senderCoins[source] < amount) {
        return message.reply(
          source === 'bank'
            ? '‼️・Tu n\'as pas assez de coins en banque.'
            : '‼️・Tu n\'as pas assez de coins en poche.'
        );
      }

      let recipientCoins = await UserCoins.findOne({
        userId: recipient.id,
        guildId
      });

      if (!recipientCoins) {
        recipientCoins = await UserCoins.create({
          userId: recipient.id,
          guildId,
          coins: 0,
          bank: 0
        });
      }

      const senderBefore = senderCoins[source];
      const recipientBefore = recipientCoins.coins;

      senderCoins[source] -= amount;
      recipientCoins.coins += amount;

      await senderCoins.save();
      await recipientCoins.save();

      await sendStaffLog(
        message.guild,
        'transaction-logs',
        buildTransferLog({
          sender: message.author,
          recipient,
          amount,
          source,
          senderBefore,
          senderAfter: senderCoins[source],
          recipientBefore,
          recipientAfter: recipientCoins.coins
        })
      );

      return message.reply(
        `Tu as payé **${formatAmount(amount)}** coins💰 à ${recipient.tag} depuis ${source === 'bank' ? 'ta banque' : 'ta poche'}.`
      );
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la transaction.');
    }
  },
};
