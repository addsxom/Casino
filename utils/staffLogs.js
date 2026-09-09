const { EmbedBuilder } = require('discord.js');
const config = require('../config/botConfig.js');
const { formatAmount } = require('./formatAmount.js');

const STAFF_LOG_CHANNELS = {
  'warn': config.channels.staffLogs.warn,
  'economy-logs': config.channels.staffLogs.economy,
  'bank-logs': config.channels.staffLogs.bank,
  'transaction-logs': config.channels.staffLogs.transaction,
  'message-logs': config.channels.staffLogs.message,
  'server-logs': config.channels.staffLogs.server,
  'voice-logs': config.channels.staffLogs.voice,
  'moderation-logs': config.channels.staffLogs.moderation
};

function normalizeChannelName(name) {
  return String(name || '').toLowerCase().trim();
}

function channelNameMatches(channel, expectedName) {
  const actual = normalizeChannelName(channel?.name);
  const expected = normalizeChannelName(expectedName);

  return actual === expected || actual.endsWith(expected);
}

function findStaffLogChannel(guild, key) {
  if (!guild) return null;

  const config = STAFF_LOG_CHANNELS[key];
  if (!config) return null;

  const channelById = guild.channels.cache.get(config.id);

  if (channelById?.isTextBased?.()) {
    if (!channelNameMatches(channelById, config.name)) {
      console.warn(
        `Salon de log ${key} trouvé par ID mais renommé : ${channelById.name}`
      );
    }

    return channelById;
  }

  return guild.channels.cache.find(channel =>
    channel?.isTextBased?.() &&
    channelNameMatches(channel, config.name)
  ) || null;
}

async function sendStaffLog(guild, key, embed) {
  try {
    const config = STAFF_LOG_CHANNELS[key];
    if (!guild || !config) return false;

    let channel = findStaffLogChannel(guild, key);

    if (!channel) {
      const fetchedById =
        await guild.channels.fetch(config.id).catch(() => null);

      if (fetchedById?.isTextBased?.()) {
        channel = fetchedById;
      }
    }

    if (!channel) {
      await guild.channels.fetch().catch(() => null);

      channel = guild.channels.cache.find(candidate =>
        candidate?.isTextBased?.() &&
        channelNameMatches(candidate, config.name)
      ) || null;
    }

    if (!channel?.isTextBased?.()) {
      console.error(
        `Salon de log introuvable pour ${key} (ID: ${config.id}, nom: ${config.name})`
      );
      return false;
    }

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
  STAFF_LOG_CHANNELS,
  findStaffLogChannel,
  sendStaffLog,
  buildEconomyLog,
  buildCoinMovementLog,
  buildTransferLog,
  buildBankTransferLog,
  buildDiscordLog
};
