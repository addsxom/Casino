const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');

function formatCompact(amount) {
  const value = Number(amount) || 0;
  const abs = Math.abs(value);

  const units = [
    { value: 1_000_000_000, suffix: 'B' },
    { value: 1_000_000, suffix: 'M' },
    { value: 1_000, suffix: 'K' }
  ];

  for (const unit of units) {
    if (abs >= unit.value) {
      const compact = value / unit.value;
      const decimals = compact >= 100 ? 0 : compact >= 10 ? 1 : 2;

      return `${Number(compact.toFixed(decimals))}${unit.suffix}`;
    }
  }

  return String(value);
}

function formatFull(amount) {
  return Number(amount || 0).toLocaleString('fr-FR');
}

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
              `## ${formatCompact(pocket)}\n` +
              `\`${formatFull(pocket)}\``,
            inline: true
          },
          {
            name: '🏦 Banque',
            value:
              `## ${formatCompact(bank)}\n` +
              `\`${formatFull(bank)}\``,
            inline: true
          },
          {
            name: '🔺 Réputation',
            value:
              `## ${formatCompact(rep)}\n` +
              `\`${formatFull(rep)}\``,
            inline: true
          },
          {
            name: '💰 Fortune totale',
            value:
              `**${formatCompact(total)} coins**  •  ` +
              `\`${formatFull(total)}\``,
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
