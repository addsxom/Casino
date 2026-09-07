const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');

module.exports = {
  name: 'depall',
  description: 'Déposez tous les coins de votre poche dans votre banque.',
  async execute(message) {
    const guildId = message.guild.id;

    try {
      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.coins < 0) {
        return message.reply('❌・Vous n\'avez pas de coins en poche.');
      }

      const amountToDeposit = userCoins.coins;

      userCoins.coins = 0;
      userCoins.bank += amountToDeposit;
      await userCoins.save();

      return message.reply(`🏦・Vous avez déposé **${amountToDeposit}** dans votre banque.`)

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du dépôt des coins.');
    }
  },
};
