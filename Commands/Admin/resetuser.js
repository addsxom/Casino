const UserCoins = require('../../Models/UserCoins.js');
const Owner = require("../../Models/Owner.js");

module.exports = {
  name: 'resetallusers',
  description: 'Réinitialiser tous les rep/coins des membres du serveur',
  async execute(message, args) {
    const isOwner = await Owner.exists({ userId: process.env.BUYER });

    if (!isOwner) return;

    try {
      
      const result = await UserCoins.deleteMany({ guildId: message.guild.id });

      if (result.deletedCount === 0) {
        return message.reply('Aucun membre du serveur n\'a de points de réputation ni de coins à réinitialiser.');
      }

      return message.reply(`Vous avez réinitialisé tous les points de réputation et les coins de tous les membres du serveur.`);
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la réinitialisation des points de réputation et des coins.');
    }
  },
};
