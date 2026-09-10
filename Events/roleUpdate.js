const {
  sendStaffLog,
  buildDiscordLog
} = require('../utils/staffLogs.js');
const {
  AuditLogEvent,
  getRecentAuditExecutor
} = require('../utils/auditLogs.js');

module.exports = async (
  _bot,
  oldRole,
  newRole
) => {
  const changes = [];

  if (
    oldRole.name !==
    newRole.name
  ) {
    changes.push(
      `**Nom :** ${oldRole.name} → ${newRole}`
    );
  }

  if (
    oldRole.color !==
    newRole.color
  ) {
    changes.push(
      `**Couleur :** ${oldRole.hexColor} → ${newRole.hexColor}`
    );
  }

  if (!changes.length) return;

  const executor =
    await getRecentAuditExecutor(
      newRole.guild,
      AuditLogEvent.RoleUpdate,
      {
        targetId:
          newRole.id
      }
    );

  await sendStaffLog(
    newRole.guild,
    'server-logs',
    buildDiscordLog({
      title: '⚙️ Rôle modifié',
      description:
        (
          oldRole.name !==
            newRole.name
            ? ''
            : `${newRole}\n`
        ) +
        `${changes.join('\n')}\n` +
        `-# Modifié par ${executor || 'Inconnu'}`,
      color: 0x5865f2
    })
  );
};
