const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');

const { requireBotOwner } = require('../../utils/ownerPermissions.js');

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

    if (isNaN(amount) || amount <= 0) {
      return message.reply('Veuillez spécifier un nombre valide supérieur à zéro.');
    }

    try {
      let userCoins = await UserCoins.findOne({ userId: targetUser.id, guildId: message.guild.id });

      if (!userCoins) {
        return message.reply(`${targetUser.tag} n'a pas de points de réputation ni de coins.`);
      }

      if (type === 'rep') {
        userCoins.rep -= amount;
        if (userCoins.rep < 0) userCoins.rep = 0;
        await userCoins.save();
        return message.reply(`Vous avez retiré ${formatAmount(amount)} points de réputation à ${targetUser.tag}.`);
      } else if (type === 'bank') {
        const removedAmount = Math.min(amount, userCoins.bank);
        userCoins.bank -= removedAmount;
        await userCoins.save();

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🛡️ Retrait admin',
            user: targetUser,
            delta: -removedAmount,
            pocket: userCoins.coins,
            bank: userCoins.bank,
            reason: 'Retrait admin depuis la banque',
            sourceChannel: message.channel,
            actor: message.author
          })
        );

        return message.reply(`Vous avez retiré ${formatAmount(amount)} coins en bank à ${targetUser.tag}.`);
      } else if (type === 'coins') {
        const removedAmount = Math.min(amount, userCoins.coins);
        userCoins.coins -= removedAmount;
        await userCoins.save();

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🛡️ Retrait admin',
            user: targetUser,
            delta: -removedAmount,
            pocket: userCoins.coins,
            bank: userCoins.bank,
            reason: 'Retrait admin depuis la poche',
            sourceChannel: message.channel,
            actor: message.author
          })
        );

        return message.reply(`Vous avez retiré ${formatAmount(amount)} coins à ${targetUser.tag}.`);
      } else {
        return message.reply('Type invalide. Veuillez spécifier "rep", "bank" ou "coins".');
      }
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors du retrait de points de réputation/coins.');
    }
  },
};
