const UserCoins = require('../../Models/UserCoins.js');
const Owner = require("../../Models/Owner.js");
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');

module.exports = {
  name: 'reset',
  description: 'Retirer tout les coins à un membre',
  usage: 'reset <@utilisateur>',
  async execute(message, args) {
    const isOwner = await Owner.exists({ userId: process.env.BUYER });

    if (!isOwner) return;

    if (args.length !== 1) {
      return message.reply('Utilisation incorrecte. Veuillez mentionner l\'utilisateur dont vous souhaitez réinitialiser les coins.');
    }

    const targetUser = message.mentions.users.first();

    if (!targetUser) {
      return message.reply('Veuillez mentionner un utilisateur.');
    }

    try {
      let userCoins = await UserCoins.findOne({ userId: targetUser.id, guildId: message.guild.id });

      if (!userCoins) {
        return message.reply(`${targetUser.tag} n'a pas de coins à réinitialiser.`);
      }

      const removedCoins = (Number(userCoins.coins) || 0) + (Number(userCoins.bank) || 0);

      userCoins.coins = 0;
      userCoins.bank = 0;
      userCoins.rep = 0;
      await userCoins.save();

      if (removedCoins > 0) {
        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🧹 Reset économie',
            user: targetUser,
            delta: -removedCoins,
            pocket: 0,
            bank: 0,
            reason: '+reset',
            sourceChannel: message.channel,
            otherUser: message.author
          })
        );
      }

      return message.reply(`Vous avez réinitialisé tous les coins/rep de ${targetUser.tag}.`);
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la réinitialisation des coins.');
    }
  },
};
