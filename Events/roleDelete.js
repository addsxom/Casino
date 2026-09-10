const {
  sendStaffLog,
  buildDiscordLog
} = require('../utils/staffLogs.js');
const {
  AuditLogEvent,
  getRecentAuditExecutor
} = require('../utils/auditLogs.js');

module.exports = async (_bot, role) => {
  const executor =
    await getRecentAuditExecutor(
      role.guild,
      AuditLogEvent.RoleDelete,
      {
        targetId: role.id
      }
    );

  await sendStaffLog(
    role.guild,
    'server-logs',
    buildDiscordLog({
      title: '➖ Rôle supprimé',
      description:
        `**${role.name}**\n` +
        `-# Supprimé par ${executor || 'Inconnu'}`,
      color: 0xed4245
    })
  );
};
