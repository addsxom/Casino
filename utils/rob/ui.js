const {
  EmbedBuilder
} = require('discord.js');

const {
  formatAmount
} = require('../formatAmount.js');

function formatDynamicTimer(
  timestampMs
) {
  if (
    !timestampMs ||
    Date.now() >= timestampMs
  ) {
    return '**0s**';
  }

  return (
    `<t:${Math.floor(
      timestampMs / 1000
    )}:R>`
  );
}

function buildInfoEmbed(
  message,
  {
    title,
    description,
    color = 0x6b6de6,
    thumbnail = null
  }
) {
  const embed =
    new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setFooter({
        text: 'Kuromi Coins',
        iconURL:
          message.client.user
            .displayAvatarURL({
              dynamic: true
            })
      });

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}

async function replyEmbed(
  message,
  buildEmbed,
  freezeAt = []
) {
  const sent =
    await message.reply({
      embeds: [buildEmbed()]
    });

  const expirations = [
    ...new Set(
      freezeAt
        .map(Number)
        .filter(timestamp =>
          Number.isFinite(timestamp) &&
          timestamp > Date.now()
        )
    )
  ];

  for (
    const expiration
    of expirations
  ) {
    const delay = Math.max(
      0,
      expiration -
        Date.now() +
        250
    );

    setTimeout(() => {
      sent.edit({
        embeds: [buildEmbed()]
      }).catch(() => {});
    }, delay);
  }

  return sent;
}

function buildSuccessEmbed({
  message,
  targetUser,
  stolenCoins,
  stolenPercent,
  jackpot,
  robberAvailableAt,
  victimAvailableAt
}) {
  const jackpotLine = jackpot
    ? '\n💎 **JACKPOT !**'
    : '';

  return buildInfoEmbed(
    message,
    {
      title: jackpot
        ? '💎 Jackpot !'
        : '🦹 Braquage réussi',
      description:
        `${message.author} ➜ ${targetUser}\n\n` +
        `💰 **${formatAmount(stolenCoins)} coins**\n` +
        `-# ${stolenPercent}% de la poche${jackpotLine}\n\n` +
        `🛡️ Protection : ${formatDynamicTimer(victimAvailableAt)}\n` +
        `⏳ Prochain rob : ${formatDynamicTimer(robberAvailableAt)}`,
      color: jackpot
        ? 0xf1c40f
        : 0x57f287,
      thumbnail:
        targetUser.displayAvatarURL({
          dynamic: true
        })
    }
  );
}

function buildFailureEmbed({
  message,
  targetUser,
  fineApplied,
  finePercent,
  fineAmount,
  robberAvailableAt
}) {
  let resultText =
    '🍀 **Aucune amende**';

  if (fineApplied) {
    resultText =
      fineAmount > 0
        ? `🚨 **-${formatAmount(fineAmount)} coins**\n-# Amende de ${finePercent}%`
        : `🚨 **Amende de ${finePercent}%**\n-# Aucun coin en poche à payer`;
  }

  return buildInfoEmbed(
    message,
    {
      title:
        '🚔 Braquage raté',
      description:
        `${message.author} ➜ ${targetUser}\n\n` +
        resultText +
        `\n\n⏳ Prochain rob : ${formatDynamicTimer(robberAvailableAt)}`,
      color: 0xed4245,
      thumbnail:
        targetUser.displayAvatarURL({
          dynamic: true
        })
    }
  );
}

module.exports = {
  formatDynamicTimer,
  buildInfoEmbed,
  replyEmbed,
  buildSuccessEmbed,
  buildFailureEmbed
};
