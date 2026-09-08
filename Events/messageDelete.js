const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { AuditLogEvent, getRecentAuditExecutor } = require('../utils/auditLogs.js');
const {
  getCachedMessage,
  deleteCachedMessage
} = require('../utils/messageCache.js');

module.exports = async (_bot, message) => {
  if (!message.guild) return;

  const cached = getCachedMessage(message.id);
  const authorId = message.author?.id || cached?.authorId || null;

  if (message.author?.bot) {
    deleteCachedMessage(message.id);
    return;
  }

  const executor = await getRecentAuditExecutor(
    message.guild,
    AuditLogEvent.MessageDelete,
    {
      targetId: authorId,
      channelId: message.channel.id,
      withinMs: 5000,
      delayMs: 900
    }
  );

  if (executor?.bot) {
    deleteCachedMessage(message.id);
    return;
  }

  const authorDisplay = message.author
    ? `${message.author}`
    : authorId
      ? `<@${authorId}>`
      : cached?.authorTag
        ? `**${cached.authorTag}**`
        : '**Auteur inconnu**';

  const rawContent = message.content || cached?.content || '';
  const content = rawContent
    ? rawContent.slice(0, 1200)
    : '*Contenu indisponible*';

  const deletedBy = executor
    ? `\n-# Supprimé par ${executor}`
    : '';

  await sendStaffLog(
    message.guild,
    'message-logs',
    buildDiscordLog({
      title: '🗑️ Message supprimé',
      description:
        `${authorDisplay} dans ${message.channel}` +
        `${deletedBy}\n\n` +
        `> ${content.replace(/\n/g, '\n> ')}`,
      color: 0xed4245
    })
  );

  deleteCachedMessage(message.id);
};
