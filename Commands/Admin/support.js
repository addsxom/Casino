const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const { TICKET_TYPES } = require('../../utils/ticketSystem.js');

function getButtonStyle(key) {
  if (key === 'general') return ButtonStyle.Primary;
  if (key === 'report') return ButtonStyle.Danger;
  return ButtonStyle.Secondary;
}

module.exports = {
  name: 'support',
  description: 'Envoie le panneau de support dans le salon actuel.',

  async execute(message) {
    const isAllowed =
      message.author.id === process.env.BUYER ||
      message.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isAllowed) {
      return message.reply('❌・Tu dois être administrateur pour utiliser cette commande.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 BESOIN D’AIDE ?')
      .setDescription(
        '**Notre équipe est là pour vous aider.**\n\n' +
        'Choisis simplement la raison de ta demande avec l’un des boutons ci-dessous. ' +
        'Un ticket privé sera créé pour que tu puisses échanger directement avec le staff.'
      )
      .addFields({
        name: 'Avant d’ouvrir un ticket',
        value:
          '• Choisis la catégorie qui correspond le mieux à ta demande.\n' +
          '• Explique clairement ton problème une fois le ticket ouvert.\n' +
          '• Évite d’ouvrir plusieurs tickets pour la même demande.'
      })
      .setColor(0x6b6de6)
      .setFooter({
        text: 'Kuromi Support',
        iconURL: message.client.user.displayAvatarURL({ dynamic: true })
      });

    const row = new ActionRowBuilder();

    for (const [key, type] of Object.entries(TICKET_TYPES)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_open_${key}`)
          .setLabel(type.label)
          .setEmoji(type.emoji)
          .setStyle(getButtonStyle(key))
      );
    }

    await message.delete().catch(() => {});

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
};
