const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { AuditLogEvent, getRecentAuditExecutor } = require('../utils/auditLogs.js');

module.exports = async (_bot, channel) => {
  if (!channel.guild) return;

  const executor = await getRecentAuditExecutor(
    channel.guild,
    AuditLogEvent.ChannelDelete,
    { targetId: channel.id }
  );

  await sendStaffLog(
    channel.guild,
    'discord-logs',
    buildDiscordLog({
      title: '➖ Salon supprimé',
      description:
        `**#${channel.name}**\n` +
        `-# Supprimé par ${executor || 'Inconnu'}`,
      color: 0xed4245
    })
  );
};
