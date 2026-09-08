const { EmbedBuilder } = require('discord.js');
const { formatAmount } = require('./formatAmount.js');

const STAFF_LOG_CHANNELS = {
  'warn': '1546311653933580418',
  'economy-logs': '1546959903271157851',
  'bank-logs': '1546959947395371089',
  'transaction-logs': '1546959992207450193',
  'message-logs': '1546960057168691291',
  'server-logs': '1546960115914121276',
  'voice-logs': '1546960169374720081',
  'moderation-logs': '1546960328502546484'
};

function findStaffLogChannel(guild, key) {
  if (!guild) return null;

  const channelId = STAFF_LOG_CHANNELS[key];
  if (!channelId) return null;

  const channel = guild.channels.cache.get(channelId);
  return channel?.isTextBased?.() ? channel : null;
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
      `${user}\n` +
      `**${formatAmount(amount)} coins**\n` +
      `-# 🪙 ${formatAmount(pocket)} • 🏦 ${formatAmount(bank)}`
    )
    .setColor(color)
    .setTimestamp();
}

function buildCoinMovementLog({
  title,
  user,
  delta,
  pocket,
  bank,
  reason,
  details = null,
  actor = null
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

  if (actor) {
    description += `\n-# Effectué par ${actor}`;
  }

  description +=
    `\n-# 🪙 ${formatAmount(pocket)} • 🏦 ${formatAmount(bank)}`;

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(isGain ? 0x57f287 : isLoss ? 0xed4245 : 0x6b6de6)
    .setTimestamp();
}

function buildTransferLog({
  sender,
  recipient,
  amount,
  source,
  senderBefore,
  senderAfter,
  recipientBefore,
  recipientAfter
}) {
  const sourceLabel = source === 'bank' ? 'Banque' : 'Poche';
  const senderLabel = source === 'bank'
    ? 'Expéditeur — Banque'
    : 'Expéditeur — Poche';

  return new EmbedBuilder()
    .setTitle('💸 Paiement')
    .setDescription(
      `${sender} ➜ ${recipient}\n` +
      `**${formatAmount(amount)} coins**\n` +
      `-# ${sourceLabel} → Poche\n\n` +
      `**${senderLabel}**\n` +
      `${formatAmount(senderBefore)} → **${formatAmount(senderAfter)}**\n\n` +
      `**Destinataire — Poche**\n` +
      `${formatAmount(recipientBefore)} → **${formatAmount(recipientAfter)}**`
    )
    .setColor(0x5865f2)
    .setTimestamp();
}

function buildBankTransferLog({
  title,
  user,
  amount,
  bankBefore,
  bankAfter,
  pocketBefore,
  pocketAfter
}) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `${user}\n` +
      `**${formatAmount(amount)} coins**\n` +
      `-# Banque → Poche\n\n` +
      `**Banque**\n` +
      `${formatAmount(bankBefore)} → **${formatAmount(bankAfter)}**\n\n` +
      `**Poche**\n` +
      `${formatAmount(pocketBefore)} → **${formatAmount(pocketAfter)}**`
    )
    .setColor(0xfee75c)
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
  buildBankTransferLog,
  buildDiscordLog
};
