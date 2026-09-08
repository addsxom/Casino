const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');

module.exports = {
  name: 'pay',
  description: 'Transférez des coins à un autre utilisateur.',
  usage: 'pay <montant> <@utilisateur>',

  async execute(message, args) {
    const guildId = message.guild.id;
    const senderId = message.author.id;

    const amount = parseAmount(args[0]);
    const recipient = message.mentions.users.first()
      || message.client.users.cache.get(args[1]);

    try {
      if (isNaN(amount) || amount <= 0) {
        return message.reply('Veuillez fournir un montant valide à payer.');
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

      if (!senderCoins || senderCoins.coins < amount) {
        return message.reply('‼️・Tu n\'as pas assez de coins en poche.');
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

      senderCoins.coins -= amount;
      recipientCoins.coins += amount;

      await senderCoins.save();
      await recipientCoins.save();

      return message.reply(
        `Tu as payé **${amount.toLocaleString('fr-FR')}** coins💰 à ${recipient.tag}.`
      );
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la transaction.');
    }
  },
};
