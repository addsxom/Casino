const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('discord.js');

const {
  formatAmount
} = require('../formatAmount.js');

const {
  getBetOptions
} = require('./gameRules.js');

const config =
  require('../../config/botConfig.js');

function separator() {
  return new SeparatorBuilder()
    .setDivider(true);
}

function formatSigned(value) {
  const number =
    Math.floor(Number(value) || 0);

  if (number >= 0) {
    return '+' + formatAmount(number);
  }

  return '-' +
    formatAmount(Math.abs(number));
}

function getSessionBalance(session) {
  return (
    Number(session.cagnotte) -
    Number(session.initialCagnotte)
  );
}

function buildBetRow(session) {
  const row =
    new ActionRowBuilder();

  const options =
    getBetOptions(
      session.cagnotte
    );

  for (const option of options) {
    let style =
      ButtonStyle.Primary;

    if (option.style === 'success') {
      style =
        ButtonStyle.Success;
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          'slot_bet_' + option.key
        )
        .setLabel(
          option.label +
          ' (' +
          formatAmount(option.amount) +
          ')'
        )
        .setStyle(style)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId('slot_withdraw')
      .setLabel(
        'Retirer (' +
        formatAmount(
          session.cagnotte
        ) +
        ')'
      )
      .setStyle(
        ButtonStyle.Danger
      )
  );

  return row;
}

function buildMenuContainer(
  message,
  session,
  megaPot
) {
  const minBet =
    config.games.slots
      .megaPotMinBet;

  return new ContainerBuilder()
    .setAccentColor(0x6b6de6)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎰 Machine à Sous'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '💰 **Cagnotte :** ' +
          formatAmount(
            session.cagnotte
          ) +
          ' coins\n' +
          '📊 **Balance :** ' +
          formatSigned(
            getSessionBalance(
              session
            )
          ) +
          ' coins'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '## 🎰 MEGAPOT : ' +
          formatAmount(megaPot) +
          ' coins\n' +
          '-# Misez au moins ' +
          formatAmount(minBet) +
          ' coins pour être éligible au MegaPot avec 777 !'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# Choisissez combien miser ou retirez votre cagnotte :'
        )
    )
    .addActionRowComponents(
      buildBetRow(session)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# ' +
          message.author.tag
        )
    );
}

function buildSpinContainer(
  message,
  reels,
  bet,
  status
) {
  return new ContainerBuilder()
    .setAccentColor(0x6b6de6)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎰 Machine à Sous'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# ' +
          reels.join('  |  ')
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '**Mise actuelle :** ' +
          formatAmount(bet) +
          ' coins'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '🎰 ' + status
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# ' +
          message.author.tag
        )
    );
}

function buildResultContainer(
  message,
  {
    reels,
    lines,
    won = false,
    jackpot = false
  }
) {
  let color = won
    ? 0x57f287
    : 0xed4245;

  if (jackpot) {
    color = 0xfee75c;
  }

  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎰 Machine à Sous'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# ' +
          reels.join('  |  ')
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          lines.join('\n')
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# ' +
          message.author.tag
        )
    );
}

function buildExhaustedContainer(
  message,
  session,
  finalPocket
) {
  return new ContainerBuilder()
    .setAccentColor(0xed4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎰 Machine à Sous'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '## Cagnotte épuisée'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '**Montant restant :** ' +
          formatAmount(
            session.cagnotte
          ) +
          ' coins\n' +
          '**Balance finale :** ' +
          formatSigned(
            getSessionBalance(
              session
            )
          ) +
          ' coins\n' +
          '**Poche :** ' +
          formatAmount(
            finalPocket
          ) +
          ' coins'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          'Pas assez pour continuer à jouer.'
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# ' +
          message.author.tag
        )
    );
}

function buildWithdrawnContainer(
  message,
  session,
  withdrawn,
  finalPocket
) {
  const finalBalance =
    Number(withdrawn) -
    Number(
      session.initialCagnotte
    );

  return new ContainerBuilder()
    .setAccentColor(0x57f287)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎰 Machine à Sous'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '## Cagnotte retirée'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '**Montant retiré :** ' +
          formatAmount(
            withdrawn
          ) +
          ' coins\n' +
          '**Balance finale :** ' +
          formatSigned(
            finalBalance
          ) +
          ' coins\n' +
          '**Poche :** ' +
          formatAmount(
            finalPocket
          ) +
          ' coins'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          'La cagnotte a été remise dans votre poche.'
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# ' +
          message.author.tag
        )
    );
}

function buildExpiredContainer(
  message,
  session,
  withdrawn,
  finalPocket
) {
  const finalBalance =
    Number(withdrawn) -
    Number(
      session.initialCagnotte
    );

  return new ContainerBuilder()
    .setAccentColor(0x95a5a6)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎰 Machine à Sous'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '## Session expirée'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '**Cagnotte rendue :** ' +
          formatAmount(
            withdrawn
          ) +
          ' coins\n' +
          '**Balance finale :** ' +
          formatSigned(
            finalBalance
          ) +
          ' coins\n' +
          '**Poche :** ' +
          formatAmount(
            finalPocket
          ) +
          ' coins'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          'Votre cagnotte restante a été retirée automatiquement.'
        )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '-# ' +
          message.author.tag
        )
    );
}

function buildStatusContainer(
  title,
  text,
  color = 0x6b6de6
) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# ' + title
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(text)
    );
}

module.exports = {
  buildStatusContainer,
  formatSigned,
  getSessionBalance,
  buildMenuContainer,
  buildSpinContainer,
  buildResultContainer,
  buildExhaustedContainer,
  buildWithdrawnContainer,
  buildExpiredContainer
};
