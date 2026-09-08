const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const { formatAmount, formatAmountPrecise, formatFullAmount } = require('../../utils/formatAmount.js');

module.exports = {
  name: 'coins',
  description: 'Affiche le solde de coins de l\'utilisateur.',

  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      let targetUser = message.mentions.users.first() || message.author;

      if (args.length > 0) {
        const userId = args[0].replace(/[<@!>]/g, '');
        targetUser = await message.client.users.fetch(userId, false);
      }

      let userCoins = await UserCoins.findOne({
        userId: targetUser.id,
        guildId
      });

      if (!userCoins) {
        userCoins = await UserCoins.create({
          userId: targetUser.id,
          guildId
        });
      }

      const pocket = Number(userCoins.coins) || 0;
      const bank = Number(userCoins.bank) || 0;
      const rep = Number(userCoins.rep) || 0;
      const total = pocket + bank;

      const displayName =
        targetUser.globalName ||
        targetUser.username;

      const avatar = targetUser.displayAvatarURL({
        dynamic: true
      });

      const embed = new EmbedBuilder()
        .setAuthor({
          name: displayName,
          iconURL: avatar
        })
        .setColor(0x6b6de6)
        .setDescription(
          `🪙 **${formatAmount(pocket)}**  \`${formatFullAmount(pocket)}\`\n` +
          `🏦 **${formatAmount(bank)}**  \`${formatFullAmount(bank)}\`\n` +
          `🔺 **${formatAmount(rep)}**  \`${formatFullAmount(rep)}\`\n\n` +
          `💰 **${formatAmountPrecise(total)}**  \`${formatFullAmount(total)}\``
        );

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);

      return message.reply(
        'Une erreur s\'est produite lors de la récupération des coins.'
      );
    }
  },
};
