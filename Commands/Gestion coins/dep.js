const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');

module.exports = {
  name: 'dep',
  description: 'Déposez des coins dans votre banque.',
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const amountToDeposit = parseAmount(args[0]);

      if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
        return message.reply('Veuillez fournir un montant valide à déposer.');
      }

      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.coins < amountToDeposit) {
        return message.reply('❌・Vous n\'avez pas de coins en poche.');
      }

      if (!userCoins || userCoins.bank || userCoins.coins < amountToDeposit) {
        return message.reply('❌・Vous n\'avez pas assez de coins pour déposer cette somme.');
      }

      userCoins.coins -= amountToDeposit;
      userCoins.bank += amountToDeposit;
      await userCoins.save();

        return message.reply(`🏦・Vous avez déposé **${amountToDeposit}** coins dans votre banque.`)

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du dépôt des coins.');
    }
  },
};