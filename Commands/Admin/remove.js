const parseAmount = require('../../utils/parseAmount.js');
const { replyEmbedPayload } = require('../../utils/replyEmbed.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');

const { requireBotOwner } = require('../../utils/ownerPermissions.js');
const { removeUpTo } = require('../../utils/economyService.js');

module.exports = {
  name: 'remove',
  description: 'Retirer des rep/coins à un membre',
  usage: 'remove <type(rep/bank/coins)> <nombre> <@utilisateur>',
  async execute(message, args) {
    if (!(await requireBotOwner(message))) return;

if (args.length !== 3) {
      return message.reply(replyEmbedPayload('Utilisation incorrecte. Veuillez spécifier le type (rep/bank/coins), le nombre et mentionner l\'utilisateur.', { type: 'error' }));
    }

    const type = args[0].toLowerCase();
    const amount = parseAmount(args[1]);
    const targetUser = message.mentions.users.first();

    if (!targetUser) {
      return message.reply(replyEmbedPayload('Veuillez mentionner un utilisateur.', { type: 'error' }));
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return message.reply(replyEmbedPayload('Veuillez spécifier un nombre valide supérieur à zéro.', { type: 'error' }));
    }

    try {
      if (type !== 'rep' && type !== 'bank' && type !== 'coins') {
        return message.reply(
          replyEmbedPayload(
            'Type invalide. Veuillez spécifier **rep**, **bank** ou **coins**.',
            { type: 'error' }
          )
        );
      }

      const movement = await removeUpTo({
        userId: targetUser.id,
        guildId: message.guild.id,
        field: type,
        amount
      });

      if (!movement) {
        return message.reply(replyEmbedPayload(targetUser.tag + " n'a pas de points de réputation ni de coins.", { type: 'warning' }));
      }

      if (type === 'rep') {
        return message.reply(replyEmbedPayload('Vous avez retiré ' + formatAmount(movement.removed) + ' points de réputation à ' + targetUser.tag + '.', { type: 'success' }));
      }

      await sendStaffLog(
        message.guild,
        'economy-logs',
        buildCoinMovementLog({
          title: '🛡️ Retrait admin',
          user: targetUser,
          delta: -movement.removed,
          pocket: movement.after.coins,
          bank: movement.after.bank,
          reason:
            type === 'bank'
              ? 'Retrait admin depuis la banque'
              : 'Retrait admin depuis la poche',
          sourceChannel: message.channel,
          actor: message.author
        })
      );

      return message.reply(replyEmbedPayload(type === 'bank' ? 'Vous avez retiré ' + formatAmount(movement.removed) + ' coins en bank à ' + targetUser.tag + '.' : 'Vous avez retiré ' + formatAmount(movement.removed) + ' coins à ' + targetUser.tag + '.', { type: 'success' }));
    } catch (error) {
      console.error(error);
      return message.reply(replyEmbedPayload('Une erreur s\'est produite lors du retrait de points de réputation/coins.', { type: 'error' }));
    }
  },
};
