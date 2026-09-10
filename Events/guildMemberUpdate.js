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
  oldMember,
  newMember
) => {
  const changes = [];

  if (
    oldMember.nickname !==
    newMember.nickname
  ) {
    changes.push(
      `**Pseudo :** ${oldMember.nickname || oldMember.user.username} → ${newMember.nickname || newMember.user.username}`
    );
  }

  const addedRoles =
    newMember.roles.cache.filter(
      role =>
        !oldMember.roles.cache.has(
          role.id
        )
    );

  const removedRoles =
    oldMember.roles.cache.filter(
      role =>
        !newMember.roles.cache.has(
          role.id
        )
    );

  let roleExecutor = null;

  if (
    addedRoles.size ||
    removedRoles.size
  ) {
    roleExecutor =
      await getRecentAuditExecutor(
        newMember.guild,
        AuditLogEvent.MemberRoleUpdate,
        {
          targetId:
            newMember.id
        }
      );
  }

  if (addedRoles.size) {
    changes.push(
      `**Rôle ajouté :** ${addedRoles.map(role => `${role}`).join(', ')}\n` +
      `-# Ajouté par ${roleExecutor || 'Inconnu'} à ${newMember.user}`
    );
  }

  if (removedRoles.size) {
    changes.push(
      `**Rôle retiré :** ${removedRoles.map(role => `${role}`).join(', ')}\n` +
      `-# Retiré par ${roleExecutor || 'Inconnu'} à ${newMember.user}`
    );
  }

  if (!changes.length) return;

  await sendStaffLog(
    newMember.guild,
    'server-logs',
    buildDiscordLog({
      title: '👤 Membre modifié',
      description:
        `${newMember.user}\n${changes.join('\n')}`,
      color: 0x5865f2
    })
  );
};
