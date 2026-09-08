const { EmbedBuilder } = require("discord.js");
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildEconomyLog } = require('../../utils/staffLogs.js');
const UserCoins = require('../../Models/UserCoins.js');

module.exports = {
  name: 'depall',
  description: 'Déposez tous les coins de votre poche dans votre banque.',
  async execute(message) {
    const guildId = message.guild.id;

    try {
      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });

      if (!userCoins || userCoins.coins < 0) {
        return message.reply('❌・Vous n\'avez pas de coins en poche.');
      }

      const amountToDeposit = userCoins.coins;

      userCoins.coins = 0;
      userCoins.bank += amountToDeposit;
      await userCoins.save();

      await sendStaffLog(
        message.guild,
        'deposit-logs',
        buildEconomyLog({
          title: '📥 Dépôt total en banque',
          user: message.author,
          amount: amountToDeposit,
          pocket: userCoins.coins,
          bank: userCoins.bank,
          sourceChannel: message.channel,
          color: 0x57f287
        })
      );

      return message.reply(`🏦・Vous avez déposé **${formatAmount(amountToDeposit)}** dans votre banque.`)

    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors du dépôt des coins.');
    }
  },
};
