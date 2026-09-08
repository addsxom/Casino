const { EmbedBuilder } = require('discord.js');
const { formatAmount } = require('./formatAmount.js');

function findStaffLogChannel(guild, key) {
  if (!guild) return null;

  const needle = String(key).toLowerCase();

  return guild.channels.cache.find(channel => {
    if (!channel?.isTextBased?.()) return false;

    const name = String(channel.name || '').toLowerCase();
    return name.includes(needle);
  }) || null;
}

async function sendStaffLog(guild, key, embed) {
  try {
    const channel = findStaffLogChannel(guild, key);
    if (!channel) return false;

    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Erreur log staff (${key}) :`, error);
    return false;
  }
}

function buildEconomyLog({
  title,
  user,
  amount,
  pocket,
  bank,
  color = 0x6b6de6
}) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `${user} • **${formatAmount(amount)} coins**`
    )
    .setColor(color)
    .addFields(
      {
        name: '🪙 Poche',
        value: `**${formatAmount(pocket)}**`,
        inline: true
      },
      {
        name: '🏦 Banque',
        value: `**${formatAmount(bank)}**`,
        inline: true
      }
    )
    .setTimestamp();
}

function buildCoinMovementLog({
  title,
  user,
  delta,
  pocket,
  bank,
  reason,
  details = null
}) {
  const amount = Math.abs(Number(delta) || 0);
  const isGain = delta > 0;
  const isLoss = delta < 0;
  const sign = isGain ? '+' : isLoss ? '-' : '';

  let description =
    `${user}\n` +
    `**${sign}${formatAmount(amount)} coins**`;

  if (reason) {
    description += `\n-# ${reason}`;
  }

  if (details) {
    description += `\n-# ${details}`;
  }

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(isGain ? 0x57f287 : isLoss ? 0xed4245 : 0x6b6de6)
    .addFields(
      {
        name: '🪙 Poche',
        value: `**${formatAmount(pocket)}**`,
        inline: true
      },
      {
        name: '🏦 Banque',
        value: `**${formatAmount(bank)}**`,
        inline: true
      }
    )
    .setTimestamp();
}

function buildTransferLog({
  sender,
  recipient,
  amount,
  source,
  senderPocket,
  senderBank,
  recipientPocket
}) {
  return new EmbedBuilder()
    .setTitle('💸 Paiement')
    .setDescription(
      `${sender} ➜ ${recipient}\n` +
      `**${formatAmount(amount)} coins**\n` +
      `-# Depuis ${source === 'bank' ? 'la banque' : 'la poche'}`
    )
    .setColor(0x5865f2)
    .addFields(
      {
        name: 'Expéditeur',
        value:
          `🪙 ${formatAmount(senderPocket)} • ` +
          `🏦 ${formatAmount(senderBank)}`,
        inline: true
      },
      {
        name: 'Destinataire',
        value: `🪙 ${formatAmount(recipientPocket)}`,
        inline: true
      }
    )
    .setTimestamp();
}

function buildDiscordLog({
  title,
  description,
  color = 0x6b6de6,
  fields = []
}) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  if (fields.length) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  findStaffLogChannel,
  sendStaffLog,
  buildEconomyLog,
  buildCoinMovementLog,
  buildTransferLog,
  buildDiscordLog
};
