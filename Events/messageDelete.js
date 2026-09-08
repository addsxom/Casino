const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { AuditLogEvent, getRecentAuditExecutor } = require('../utils/auditLogs.js');

module.exports = async (_bot, message) => {
  if (!message.guild || message.author?.bot) return;

  const executor = await getRecentAuditExecutor(
    message.guild,
    AuditLogEvent.MessageDelete,
    {
      targetId: message.author?.id || null,
      channelId: message.channel.id,
      withinMs: 5000,
      delayMs: 900
    }
  );

  // Les suppressions effectuées par un bot ne polluent pas discord-logs.
  if (executor?.bot) return;

  const content = message.content
    ? message.content.slice(0, 1200)
    : '*Contenu indisponible*';

  const deletedBy = executor
    ? `\n-# Supprimé par ${executor}`
    : '';

  await sendStaffLog(
    message.guild,
    'discord-logs',
    buildDiscordLog({
      title: '🗑️ Message supprimé',
      description:
        `${message.author || '**Auteur inconnu**'} dans ${message.channel}` +
        `${deletedBy}\n\n` +
        `> ${content.replace(/\n/g, '\n> ')}`,
      color: 0xed4245
    })
  );
};
