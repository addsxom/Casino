const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');

module.exports = {
  name: 'pay',
  description: 'Transférez des coins à un autre utilisateur.',
  usage: 'pay <@utilisateur> <montant>',
  async execute(message, args) {
    const guildId = message.guild.id;
    const senderId = message.author.id;
    const recipient = message.mentions.users.first() || message.client.users.cache.get(args[0]);
    const amount = parseInt(args[1]);

    try {
      if (!recipient) {
        return message.reply('Veuillez mentionner un utilisateur valide.');
      }

      if (isNaN(amount) || amount <= 0) {
        return message.reply('Veuillez fournir un montant valide à payer.');
      }

      const senderCoins = await UserCoins.findOne({ userId: senderId, guildId });

      if (!senderCoins || senderCoins.coins < amount) {
        return message.reply('‼️・Tu n\'as pas assez de coins en poche.');
      }

      senderCoins.coins -= amount;
      const recipientCoins = await UserCoins.findOne({ userId: recipient.id, guildId }) || await UserCoins.create({ userId: recipient.id, guildId });
      recipientCoins.coins += amount;

      await senderCoins.save();
      await recipientCoins.save();

      const confirmationMessage = `Tu as payé **${amount}** coins💰 à ${recipient.tag}.`

      message.reply(confirmationMessage);
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors de la transaction.');
    }
  },
};
