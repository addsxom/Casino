const UserCoins = require('../../Models/UserCoins.js');
const { replyEmbedPayload } = require('../../utils/replyEmbed.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildDiscordLog } = require('../../utils/staffLogs.js');

const { requireBotOwner } = require('../../utils/ownerPermissions.js');

module.exports = {
  name: 'resetallusers',
  description: 'Réinitialiser tous les rep/coins des membres du serveur',
  async execute(message, args) {
    if (!(await requireBotOwner(message))) return;

try {
      const users = await UserCoins.find({ guildId: message.guild.id });

      const totalRemoved = users.reduce(
        (total, user) =>
          total +
          (Number(user.coins) || 0) +
          (Number(user.bank) || 0),
        0
      );

      const result = await UserCoins.deleteMany({ guildId: message.guild.id });

      if (result.deletedCount === 0) {
        return message.reply(replyEmbedPayload('Aucun membre du serveur n\'a de points de réputation ni de coins à réinitialiser.', { type: 'warning' }));
      }

      await sendStaffLog(
        message.guild,
        'economy-logs',
        buildDiscordLog({
          title: '🧹 Reset économie global',
          description:
            `${message.author} a réinitialisé **${result.deletedCount} comptes**.\n` +
            `**-${formatAmount(totalRemoved)} coins** supprimés.`,
          color: 0xed4245
        })
      );

      return message.reply(replyEmbedPayload('Vous avez réinitialisé tous les points de réputation et les coins de tous les membres du serveur.', { type: 'success' }));
    } catch (error) {
      console.error(error);
      return message.reply(replyEmbedPayload('Une erreur s\'est produite lors de la réinitialisation des points de réputation et des coins.', { type: 'error' }));
    }
  },
};
