const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { AuditLogEvent, getRecentAuditExecutor } = require('../utils/auditLogs.js');

module.exports = async (_bot, channel) => {
  if (!channel.guild) return;

  const executor = await getRecentAuditExecutor(
    channel.guild,
    AuditLogEvent.ChannelCreate,
    { targetId: channel.id }
  );

  await sendStaffLog(
    channel.guild,
    'server-logs',
    buildDiscordLog({
      title: '➕ Salon créé',
      description:
        `${channel}\n` +
        `-# Créé par ${executor || 'Inconnu'}`,
      color: 0x57f287
    })
  );
};
