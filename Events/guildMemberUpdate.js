const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldMember, newMember) => {
  const changes = [];

  if (oldMember.nickname !== newMember.nickname) {
    changes.push(
      `**Pseudo :** ${oldMember.nickname || oldMember.user.username} → ${newMember.nickname || newMember.user.username}`
    );
  }

  const addedRoles = newMember.roles.cache.filter(
    role => !oldMember.roles.cache.has(role.id)
  );
  const removedRoles = oldMember.roles.cache.filter(
    role => !newMember.roles.cache.has(role.id)
  );

  if (addedRoles.size) {
    changes.push(
      `**Rôle ajouté :** ${addedRoles.map(role => `${role}`).join(', ')}`
    );
  }

  if (removedRoles.size) {
    changes.push(
      `**Rôle retiré :** ${removedRoles.map(role => role.name).join(', ')}`
    );
  }

  if (!changes.length) return;

  await sendStaffLog(
    newMember.guild,
    'discord-logs',
    buildDiscordLog({
      title: '👤 Membre modifié',
      description: `${newMember.user}\n${changes.join('\n')}`,
      color: 0x5865f2
    })
  );
};
