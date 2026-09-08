const parseAmount = require('../../utils/parseAmount.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');

const { requireBotOwner } = require('../../utils/ownerPermissions.js');
const { creditBalance, incrementAccountField } = require('../../utils/economyService.js');

module.exports = {
  name: 'add',
  description: 'Ajouter des rep/coins à un membre',
  usage: 'add <type(rep/bank/coins)> <nombre> <@utilisateur>',
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
      let userCoins;

      if (type === 'rep') {
        userCoins = await incrementAccountField({
          userId: targetUser.id,
          guildId: message.guild.id,
          field: 'rep',
          amount
        });

        return message.reply(
          'Vous avez ajouté ' + formatAmount(amount) +
          ' points de réputation à ' + targetUser.tag + '.'
        );
      }

      if (type !== 'bank' && type !== 'coins') {
        return message.reply(
          'Type invalide. Veuillez spécifier "rep", "bank" ou "coins".'
        );
      }

      userCoins = await creditBalance({
        userId: targetUser.id,
        guildId: message.guild.id,
        target: type,
        amount
      });

      await sendStaffLog(
        message.guild,
        'economy-logs',
        buildCoinMovementLog({
          title: '🛡️ Ajout admin',
          user: targetUser,
          delta: amount,
          pocket: userCoins.coins,
          bank: userCoins.bank,
          reason:
            type === 'bank'
              ? 'Ajout admin dans la banque'
              : 'Ajout admin dans la poche',
          sourceChannel: message.channel,
          actor: message.author
        })
      );

      return message.reply(
        type === 'bank'
          ? 'Vous avez ajouté ' + formatAmount(amount) +
            ' coins en bank à ' + targetUser.tag + '.'
          : 'Vous avez ajouté ' + formatAmount(amount) +
            ' coins à ' + targetUser.tag + '.'
      );
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de l\'ajout de points de réputation/coins.');
    }
  },
};
