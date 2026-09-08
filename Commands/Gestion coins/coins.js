const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require("discord.js");

const UserCoins = require('../../Models/UserCoins.js');
const {
  formatAmount,
  formatAmountPrecise,
  formatFullAmount
} = require('../../utils/formatAmount.js');

function buildSummaryEmbed(message, targetUser, userCoins) {
  const pocket = Number(userCoins.coins) || 0;
  const bank = Number(userCoins.bank) || 0;
  const rep = Number(userCoins.rep) || 0;

  return new EmbedBuilder()
    .setAuthor({
      name: targetUser.tag,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })
    .setDescription(
      `🪙 **${formatAmount(pocket)}** coins en poche\n` +
      `🏦 **${formatAmount(bank)}** coins en banque\n` +
      `🔺 **${formatAmount(rep)}** Réputation`
    )
    .setFooter({
      text: 'Kuromi Coins',
      iconURL: message.client.user.displayAvatarURL({ dynamic: true })
    })
    .setColor(0x6b6de6);
}

function buildDetailsEmbed(message, targetUser, userCoins) {
  const pocket = Number(userCoins.coins) || 0;
  const bank = Number(userCoins.bank) || 0;
  const rep = Number(userCoins.rep) || 0;
  const total = pocket + bank;

  return new EmbedBuilder()
    .setAuthor({
      name: targetUser.tag,
      iconURL: targetUser.displayAvatarURL({ dynamic: true })
    })
    .setDescription(
      `🪙 **${formatAmount(pocket)}** coins en poche\n` +
      `-# ${formatFullAmount(pocket)} exactement\n\n` +
      `🏦 **${formatAmount(bank)}** coins en banque\n` +
      `-# ${formatFullAmount(bank)} exactement\n\n` +
      `🔺 **${formatAmount(rep)}** Réputation\n` +
      `-# ${formatFullAmount(rep)} exactement\n\n` +
      `💰 **${formatAmountPrecise(total)}** Fortune totale\n` +
      `-# ${formatFullAmount(total)} exactement`
    )
    .setFooter({
      text: 'Kuromi Coins',
      iconURL: message.client.user.displayAvatarURL({ dynamic: true })
    })
    .setColor(0x6b6de6);
}

function buildDetailsButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('coins_details')
      .setLabel('Plus de détails')
      .setEmoji('🔎')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('coins_back')
      .setLabel('Retour')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary)
  );
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

      const coinsMessage = await message.reply({
        embeds: [buildSummaryEmbed(message, targetUser, userCoins)],
        components: [buildDetailsButton()]
      });

      const collector = coinsMessage.createMessageComponentCollector({
        time: 120000
      });

      collector.on('collect', async interaction => {
        try {
          if (interaction.user.id !== message.author.id) {
            return interaction.reply({
              content: '❌・Ce bouton ne vous appartient pas.',
              flags: MessageFlags.Ephemeral
            }).catch(() => {});
          }

          await interaction.deferUpdate();

          userCoins = await UserCoins.findOne({
            userId: targetUser.id,
            guildId
          });

          if (!userCoins) {
            userCoins = await UserCoins.create({
              userId: targetUser.id,
              guildId
            });
          }

          if (interaction.customId === 'coins_details') {
            return coinsMessage.edit({
              embeds: [buildDetailsEmbed(message, targetUser, userCoins)],
              components: [buildBackButton()]
            });
          }

          if (interaction.customId === 'coins_back') {
            return coinsMessage.edit({
              embeds: [buildSummaryEmbed(message, targetUser, userCoins)],
              components: [buildDetailsButton()]
            });
          }
        } catch (error) {
          if (error?.code !== 10062) {
            console.error('Erreur bouton +coins :', error);
          }
        }
      });

      collector.on('end', async () => {
        await coinsMessage.edit({
          components: []
        }).catch(() => {});
      });

      return coinsMessage;
    } catch (error) {
      console.error(error);

      return message.reply(
        'Une erreur s\'est produite lors de la récupération des coins.'
      );
    }
  },
};
