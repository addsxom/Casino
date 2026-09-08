const { AuditLogEvent } = require('discord.js');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRecentAuditExecutor(
  guild,
  type,
  {
    targetId = null,
    channelId = null,
    withinMs = 7000,
    delayMs = 700
  } = {}
) {
  if (!guild) return null;

  try {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    const logs = await guild.fetchAuditLogs({
      type,
      limit: 8
    });

    const now = Date.now();

    const entry = logs.entries.find(log => {
      if (now - log.createdTimestamp > withinMs) return false;

      const logTargetId = log.target?.id || log.targetId || null;
      if (targetId && logTargetId !== targetId) return false;

      const logChannelId =
        log.extra?.channel?.id ||
        log.extra?.channelId ||
        null;

      if (channelId && logChannelId !== channelId) return false;

      return true;
    });

    return entry?.executor || null;
  } catch (error) {
    console.error('Erreur Audit Log :', error);
    return null;
  }
}

module.exports = {
  AuditLogEvent,
  getRecentAuditExecutor
};
