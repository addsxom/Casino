const { EmbedBuilder } = require("discord.js");
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildEconomyLog } = require('../../utils/staffLogs.js');
const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');

module.exports = {
  name: 'dep',
  description: 'Déposez des coins dans votre banque.',
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const amountToDeposit = parseAmount(args[0]);

      if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
        return message.reply('Veuillez fournir un montant valide à déposer.');
      }

      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.coins <= 0) {
        return message.reply('❌・Vous n\'avez pas de coins en poche.');
      }

      if (userCoins.coins < amountToDeposit) {
        return message.reply('❌・Vous n\'avez pas assez de coins pour déposer cette somme.');
      }

      userCoins.coins -= amountToDeposit;
      userCoins.bank += amountToDeposit;
      await userCoins.save();

      await sendStaffLog(
        message.guild,
        'deposit-logs',
        buildEconomyLog({
          title: '📥 Dépôt en banque',
          user: message.author,
          amount: amountToDeposit,
          pocket: userCoins.coins,
          bank: userCoins.bank,
          sourceChannel: message.channel,
          color: 0x57f287
        })
      );

      return message.reply(`🏦・Vous avez déposé **${formatAmount(amountToDeposit)}** coins dans votre banque.`)

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du dépôt des coins.');
    }
  },
};