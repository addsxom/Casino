const {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  renderBlackjackTable
} = require('./tableRenderer.js');

function buildTableVisual(
  message,
  state,
  options = {}
) {
  const image = renderBlackjackTable(
    message,
    state,
    options
  );
  const attachmentName =
    `blackjack-${message.author.id}.png`;

  const embed = new EmbedBuilder()
    .setColor(
      options.color ||
      0x6b6de6
    )
    .setImage(
      `attachment://${attachmentName}`
    )
    .setFooter({
      text:
        'Fortuna Lounge • Blackjack • Croupier à 17 • Blackjack 3:2',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    });

  return {
    embed,
    file: new AttachmentBuilder(
      image,
      {
        name: attachmentName
      }
    )
  };
}

function buildActionRow({
  canDouble = true,
  disabled = false
} = {}) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('blackjack_hit')
        .setLabel('Tirer')
        .setEmoji('🃏')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('blackjack_stand')
        .setLabel('Rester')
        .setEmoji('✋')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('blackjack_double')
        .setLabel('Doubler')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
        .setDisabled(
          disabled ||
          !canDouble
        )
    );
}

module.exports = {
  buildTableVisual,
  buildActionRow
};
