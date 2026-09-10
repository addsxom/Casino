const {
  PermissionFlagsBits,
  EmbedBuilder
} = require('discord.js');

const {
  isStaff,
  getStaffRoles
} = require('./ticketSystem.js');

const {
  sendStaffLog
} = require('./staffLogs.js');

const WRITE_PERMISSIONS = {
  SendMessages: true,
  SendMessagesInThreads: true,
  CreatePublicThreads: true,
  CreatePrivateThreads: true
};

const LOCKED_PERMISSIONS = {
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false
};

function isLockableChannel(channel) {
  return Boolean(
    channel?.guild &&
    channel.isTextBased?.() &&
    !channel.isThread?.() &&
    channel.permissionOverwrites?.edit
  );
}

async function resolveTargetChannel(message, args = []) {
  const mentioned =
    message.mentions.channels.first();

  if (mentioned) return mentioned;

  const rawId =
    args.join(' ').match(/\b\d{17,20}\b/)?.[0];

  if (rawId) {
    return (
      message.guild.channels.cache.get(rawId) ||
      await message.guild.channels
        .fetch(rawId)
        .catch(() => null)
    );
  }

  if (args.length > 0) {
    return null;
  }

  return message.channel;
}

async function ensureStaffCanWrite(channel) {
  const staffRoles =
    getStaffRoles(channel.guild);

  const updates = [
    ...staffRoles.values()
  ].map(role =>
    channel.permissionOverwrites.edit(
      role,
      WRITE_PERMISSIONS,
      {
        reason:
          'Salon verrouillé : écriture réservée au staff'
      }
    )
  );

  const botMember =
    channel.guild.members.me;

  if (botMember) {
    updates.push(
      channel.permissionOverwrites.edit(
        botMember,
        WRITE_PERMISSIONS,
        {
          reason:
            'Salon verrouillé : accès écriture du bot'
        }
      )
    );
  }

  await Promise.all(updates);
}

async function lockChannel(channel, actor) {
  await channel.permissionOverwrites.edit(
    channel.guild.roles.everyone,
    LOCKED_PERMISSIONS,
    {
      reason:
        `Salon verrouillé par ${actor.tag}`
    }
  );

  await ensureStaffCanWrite(channel);
}

async function unlockChannel(channel, actor) {
  await channel.permissionOverwrites.edit(
    channel.guild.roles.everyone,
    WRITE_PERMISSIONS,
    {
      reason:
        `Salon déverrouillé par ${actor.tag}`
    }
  );
}

function isChannelLocked(channel) {
  const overwrite =
    channel?.permissionOverwrites?.cache
      ?.get(channel.guild.id);

  return Boolean(
    overwrite?.deny?.has(
      PermissionFlagsBits.SendMessages
    )
  );
}

async function sendChannelLockLog({
  guild,
  channel,
  actor,
  locked
}) {
  const embed = new EmbedBuilder()
    .setColor(0x6b6de6)
    .setTitle(
      locked
        ? '🔒 Salon verrouillé'
        : '🔓 Salon déverrouillé'
    )
    .setDescription(
      `**Salon :** ${channel}\n` +
      `**Effectué par :** ${actor}`
    )
    .setTimestamp();

  await sendStaffLog(
    guild,
    'moderation-logs',
    embed
  );
}

module.exports = {
  isStaff,
  isLockableChannel,
  resolveTargetChannel,
  lockChannel,
  unlockChannel,
  isChannelLocked,
  sendChannelLockLog
};
