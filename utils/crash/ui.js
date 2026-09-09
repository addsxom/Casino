const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const {
  formatAmount: formatCoins
} = require('../formatAmount.js');

function buildPlayingEmbed(
  message,
  game
) {
  const potential = Math.floor(
    game.amount * game.multiplier
  );

  return new EmbedBuilder()
    .setColor(0x8b8df8)
    .setTitle(
      `🚀 x${game.multiplier.toFixed(2)}`
    )
    .setDescription(
      `**Gain actuel :** ${formatCoins(potential)} coins🪙\n` +
      `**Mise :** ${formatCoins(game.amount)} coins🪙\n\n` +
      '🟢 **En cours**'
    )
    .setFooter({
      text:
        `${message.author.tag} • Cash Out avant le crash`
    });
}

function buildResultEmbed(
  message,
  game
) {
  if (game.status === 'lost') {
    return new EmbedBuilder()
      .setColor(0xef476f)
      .setTitle(
        `💥 Crash à x${game.crashPoint.toFixed(2)}`
      )
      .setDescription(
        `**Perte :** -${formatCoins(game.amount)} coins🪙`
      )
      .setFooter({
        text:
          `${message.author.tag} • Terminé`
      });
  }

  return new EmbedBuilder()
    .setColor(0x46d18c)
    .setTitle(
      `✅ Cash Out à x${game.cashoutMultiplier.toFixed(2)}`
    )
    .setDescription(
      `**Gain :** ${formatCoins(game.payout)} coins🪙\n` +
      `**Mise :** ${formatCoins(game.amount)} coins🪙`
    )
    .setFooter({
      text:
        `${message.author.tag} • Terminé`
    });
}

function buildCashoutRow() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'crash_cashout'
          )
          .setLabel('Cash Out')
          .setEmoji('💰')
          .setStyle(
            ButtonStyle.Success
          )
      )
  ];
}

module.exports = {
  buildPlayingEmbed,
  buildResultEmbed,
  buildCashoutRow
};
