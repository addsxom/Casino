const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldMember, newMember) => {
  const changes = [];

  if (oldMember.nickname !== newMember.nickname) {
    changes.push({
      name: 'Pseudo',
      value: `${oldMember.nickname || oldMember.user.username} → ${newMember.nickname || newMember.user.username}`,
      inline: false
    });
  }

  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

  if (addedRoles.size) {
    changes.push({
      name: 'Rôle ajouté',
      value: addedRoles.map(role => `${role}`).join(', ').slice(0, 1000),
      inline: false
    });
  }

  if (removedRoles.size) {
    changes.push({
      name: 'Rôle retiré',
      value: removedRoles.map(role => `${role.name}`).join(', ').slice(0, 1000),
      inline: false
    });
  }

  if (!changes.length) return;

  await sendStaffLog(
    newMember.guild,
    'discord-logs',
    buildDiscordLog({
      title: '👤 Membre modifié',
      description: `${newMember.user} • \`${newMember.id}\``,
      color: 0x5865f2,
      fields: changes
    })
  );
};
