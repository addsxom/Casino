const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const { TICKET_TYPES } = require('../../utils/ticketSystem.js');

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
      .setTitle('🎫 Support')
      .setDescription(
        'Besoin d\'aide ? Choisis la raison de ton ticket avec un bouton ci-dessous.\n\n' +
        'Un salon privé sera créé automatiquement et sera visible uniquement par toi et le staff.'
      )
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
          .setStyle(ButtonStyle.Secondary)
      );
    }

    return message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
};
