const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  formatAmount
} = require('../formatAmount.js');
const {
  getHandValue
} = require('./gameRules.js');

function renderCard(card) {
  if (!card) return '🂠';
  return `${card.rank}${card.suit}`;
}

function renderHand(
  hand,
  { hideHoleCard = false } = {}
) {
  if (!hand?.length) {
    return '`—`';
  }

  const cards = hand.map(
    (card, index) =>
      hideHoleCard && index === 1
        ? '🂠'
        : renderCard(card)
  );

  return `\`${cards.join('  ')}\``;
}

function getDealerValueText(
  hand,
  hideHoleCard
) {
  if (!hand?.length) return '—';

  if (
    hideHoleCard &&
    hand.length > 1
  ) {
    return String(
      getHandValue([hand[0]]).total
    );
  }

  return String(
    getHandValue(hand).total
  );
}

function buildTableEmbed(
  message,
  state,
  {
    revealDealer = false,
    statusText = null,
    title = '♠️ BLACKJACK • FORTUNA LOUNGE',
    color = 0x6b6de6
  } = {}
) {
  const playerValue =
    state.player.length
      ? getHandValue(state.player).total
      : '—';
  const dealerValue =
    getDealerValueText(
      state.dealer,
      !revealDealer
    );
  const displayName =
    message.member?.displayName ||
    message.author.username;

  let description =
    '🎩 **CROUPIER**\n' +
    `${renderHand(state.dealer, {
      hideHoleCard: !revealDealer
    })}\n` +
    `-# Valeur${revealDealer ? '' : ' visible'} : ${dealerValue}\n\n` +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    `👤 **${displayName}**\n` +
    `${renderHand(state.player)}\n` +
    `-# Valeur : ${playerValue}\n\n` +
    `💰 **Mise :** \`${formatAmount(state.bet)} coins\``;

  if (state.doubled) {
    description += '\n-# Mise doublée';
  }

  if (statusText) {
    description += `\n\n${statusText}`;
  }

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({
      text:
        'Blackjack • Le croupier reste à 17 • Blackjack naturel 3:2',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    });
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
  renderCard,
  renderHand,
  buildTableEmbed,
  buildActionRow
};
