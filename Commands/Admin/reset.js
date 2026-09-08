const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');

const { requireBotOwner } = require('../../utils/ownerPermissions.js');
const { resetAccount } = require('../../utils/economyService.js');

module.exports = {
  name: 'reset',
  description: 'Retirer tout les coins à un membre',
  usage: 'reset <@utilisateur>',
  async execute(message, args) {
    if (!(await requireBotOwner(message))) return;

if (args.length !== 1) {
      return message.reply('Utilisation incorrecte. Veuillez mentionner l\'utilisateur dont vous souhaitez réinitialiser les coins.');
    }

    const targetUser = message.mentions.users.first();

    if (!targetUser) {
      return message.reply('Veuillez mentionner un utilisateur.');
    }

    try {
      const reset = await resetAccount(
        targetUser.id,
        message.guild.id
      );

      if (!reset) {
        return message.reply(
          targetUser.tag + " n'a pas de coins à réinitialiser."
        );
      }

      if (reset.removedCoins > 0) {
        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🧹 Reset économie',
            user: targetUser,
            delta: -reset.removedCoins,
            pocket: 0,
            bank: 0,
            reason: '+reset',
            sourceChannel: message.channel,
            actor: message.author
          })
        );
      }

      return message.reply(
        'Vous avez réinitialisé tous les coins/rep de ' +
        targetUser.tag + '.'
      );
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la réinitialisation des coins.');
    }
  },
};
