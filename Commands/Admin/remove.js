const parseAmount = require('../../utils/parseAmount.js');
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
      return message.reply('Utilisation incorrecte. Veuillez spécifier le type (rep/bank/coins), le nombre et mentionner l\'utilisateur.');
    }

    const type = args[0].toLowerCase();
    const amount = parseAmount(args[1]);
    const targetUser = message.mentions.users.first();

    if (!targetUser) {
      return message.reply('Veuillez mentionner un utilisateur.');
    }

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return message.reply('Veuillez spécifier un nombre valide supérieur à zéro.');
    }

    try {
      if (type !== 'rep' && type !== 'bank' && type !== 'coins') {
        return message.reply(
          'Type invalide. Veuillez spécifier "rep", "bank" ou "coins".'
        );
      }

      const movement = await removeUpTo({
        userId: targetUser.id,
        guildId: message.guild.id,
        field: type,
        amount
      });

      if (!movement) {
        return message.reply(
          targetUser.tag +
          " n'a pas de points de réputation ni de coins."
        );
      }

      if (type === 'rep') {
        return message.reply(
          'Vous avez retiré ' + formatAmount(movement.removed) +
          ' points de réputation à ' + targetUser.tag + '.'
        );
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

      return message.reply(
        type === 'bank'
          ? 'Vous avez retiré ' + formatAmount(movement.removed) +
            ' coins en bank à ' + targetUser.tag + '.'
          : 'Vous avez retiré ' + formatAmount(movement.removed) +
            ' coins à ' + targetUser.tag + '.'
      );
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors du retrait de points de réputation/coins.');
    }
  },
};
