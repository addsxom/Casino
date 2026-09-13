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

const DEFAULT_COLOR = 0x6b6de6;

function renderCard(card) {
  if (!card) return '`🂠`';

  return `\`${card.rank}${card.suit}\``;
}

function renderHand(
  hand,
  { hideHoleCard = false } = {}
) {
  if (!hand?.length) {
    return '`—`';
  }

  return hand
    .map((card, index) =>
      hideHoleCard && index === 1
        ? '`🂠`'
        : renderCard(card)
    )
    .join('  ');
}

function getDealerValue(
  hand,
  hideHoleCard
) {
  if (!hand?.length) {
    return {
      total: '—',
      soft: false
    };
  }

  if (
    hideHoleCard &&
    hand.length > 1
  ) {
    return getHandValue([hand[0]]);
  }

  return getHandValue(hand);
}

function getValueLine(
  value,
  {
    visible = false,
    bust = false
  } = {}
) {
  const prefix = visible
    ? 'Total visible'
    : 'Total';

  if (bust) {
    return `-# ${prefix} : **${value}** • 💥 BUST`;
  }

  return (
    `-# ${prefix} : **${value}**` +
    (value !== '—' && value?.soft
      ? ' • As souple'
      : '')
  );
}

function buildTableEmbed(
  message,
  state,
  {
    revealDealer = false,
    statusText = null,
    title = '♠️ BLACKJACK • FORTUNA LOUNGE',
    color = DEFAULT_COLOR
  } = {}
) {
  const playerValue =
    state.player.length
      ? getHandValue(state.player)
      : {
          total: '—',
          soft: false,
          bust: false
        };

  const dealerValue =
    getDealerValue(
      state.dealer,
      !revealDealer
    );

  const displayName = String(
    message.member?.displayName ||
    message.author.username ||
    'Joueur'
  ).slice(0, 70);

  const dealerTotalText =
    !revealDealer &&
    state.dealer.length > 1
      ? `-# Total visible : **${dealerValue.total}**`
      : `-# Total : **${dealerValue.total}**${dealerValue.bust ? ' • 💥 BUST' : ''}`;

  const playerTotalText =
    `-# Total : **${playerValue.total}**` +
    (playerValue.bust
      ? ' • 💥 BUST'
      : playerValue.soft
        ? ' • As souple'
        : '');

  const stakeText =
    `\`${formatAmount(state.bet)} coins\`` +
    (
      state.doubled
        ? '\n-# ✨ Mise doublée'
        : ''
    );

  const status =
    statusText ||
    '🎩 **Le croupier prépare la table...**';

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name:
        'Fortuna Lounge • Table de Blackjack',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    })
    .setTitle(title)
    .setDescription(status)
    .addFields(
      {
        name: '🎩 CROUPIER',
        value:
          `${renderHand(state.dealer, {
            hideHoleCard: !revealDealer
          })}\n${dealerTotalText}`
      },
      {
        name: `👤 ${displayName}`,
        value:
          `${renderHand(state.player)}\n${playerTotalText}`
      },
      {
        name: '💰 MISE',
        value: stakeText,
        inline: true
      },
      {
        name: '📋 TABLE',
        value:
          'Croupier à **17**\n' +
          'Blackjack naturel **3:2**',
        inline: true
      }
    )
    .setFooter({
      text:
        '🃏 Tirer • ✋ Rester • 💰 Doubler • Inactivité : rester automatique',
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
