const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');

module.exports = {
  name: 'retall',
  description: 'Retirez tous les coins de votre banque vers votre poche.',
  async execute(message) {
    const guildId = message.guild.id;

    try {
      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.bank <= 0) {
        return message.reply('❌・Vous n\'avez pas de coins a retiré.');
      }

      const amountToWithdraw = userCoins.bank;

      userCoins.coins += amountToWithdraw;
      userCoins.bank = 0;
      await userCoins.save();

      return message.reply(`🏦・Vous avez retiré **${amountToWithdraw}** de votre banque.`)

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du retrait des coins.');
    }
  },
};
