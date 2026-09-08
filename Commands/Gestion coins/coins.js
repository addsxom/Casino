const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const { formatAmount, formatFullAmount } = require('../../utils/formatAmount.js');

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
        dynamic: true,
        size: 256
      });

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `Portefeuille de ${displayName}`,
          iconURL: avatar
        })
        .setThumbnail(avatar)
        .setColor(0x6b6de6)
        .addFields(
          {
            name: '🪙 Poche',
            value:
              `## ${formatAmount(pocket)}\n` +
              `\`${formatFullAmount(pocket)}\``,
            inline: true
          },
          {
            name: '🏦 Banque',
            value:
              `## ${formatAmount(bank)}\n` +
              `\`${formatFullAmount(bank)}\``,
            inline: true
          },
          {
            name: '🔺 Réputation',
            value:
              `## ${formatAmount(rep)}\n` +
              `\`${formatFullAmount(rep)}\``,
            inline: true
          },
          {
            name: '💰 Fortune totale',
            value:
              `**${formatAmount(total)} coins**  •  ` +
              `\`${formatFullAmount(total)}\``,
            inline: false
          }
        )
        .setFooter({
          text: 'Kuromi Coins',
          iconURL: message.client.user.displayAvatarURL({ dynamic: true })
        });

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);

      return message.reply(
        'Une erreur s\'est produite lors de la récupération des coins.'
      );
    }
  },
};
