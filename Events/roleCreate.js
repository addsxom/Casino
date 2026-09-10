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
      AuditLogEvent.RoleCreate,
      {
        targetId: role.id
      }
    );

  await sendStaffLog(
    role.guild,
    'server-logs',
    buildDiscordLog({
      title: '➕ Rôle créé',
      description:
        `${role}\n` +
        `-# Créé par ${executor || 'Inconnu'}`,
      color: 0x57f287
    })
  );
};
