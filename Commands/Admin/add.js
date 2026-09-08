const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');
const Owner = require("../../Models/Owner.js");
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');

module.exports = {
  name: 'add',
  description: 'Ajouter des rep/coins à un membre',
  usage: 'add <type(rep/bank/coins)> <nombre> <@utilisateur>',
  async execute(message, args) {
    const isOwner = await Owner.exists({ userId: process.env.BUYER });

    if (!isOwner) return;

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
        userCoins = await UserCoins.create({ userId: targetUser.id, guildId: message.guild.id });
      }

      if (type === 'rep') {
        userCoins.rep += amount;
        await userCoins.save();
        return message.reply(`Vous avez ajouté ${formatAmount(amount)} points de réputation à ${targetUser.tag}.`);
      } else if (type === 'bank') {
        userCoins.bank += amount;
        await userCoins.save();

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🛡️ Ajout admin',
            user: targetUser,
            delta: amount,
            pocket: userCoins.coins,
            bank: userCoins.bank,
            reason: 'Ajout admin dans la banque',
            sourceChannel: message.channel,
            otherUser: message.author
          })
        );

        return message.reply(`Vous avez ajouté ${formatAmount(amount)} coins en bank à ${targetUser.tag}.`);
      } else if (type === 'coins') {
        userCoins.coins += amount;
        await userCoins.save();

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '🛡️ Ajout admin',
            user: targetUser,
            delta: amount,
            pocket: userCoins.coins,
            bank: userCoins.bank,
            reason: 'Ajout admin dans la poche',
            sourceChannel: message.channel,
            otherUser: message.author
          })
        );

        return message.reply(`Vous avez ajouté ${formatAmount(amount)} coins à ${targetUser.tag}.`);
      } else {
        return message.reply('Type invalide. Veuillez spécifier "rep", "bank" ou "coins".');
      }
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de l\'ajout de points de réputation/coins.');
    }
  },
};
