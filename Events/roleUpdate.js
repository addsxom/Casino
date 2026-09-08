const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldRole, newRole) => {
  const changes = [];

  if (oldRole.name !== newRole.name) {
    changes.push({
      name: 'Nom',
      value: `${oldRole.name} → ${newRole.name}`,
      inline: false
    });
  }

  if (oldRole.color !== newRole.color) {
    changes.push({
      name: 'Couleur',
      value: `${oldRole.hexColor} → ${newRole.hexColor}`,
      inline: false
    });
  }

  if (!changes.length) return;

  await sendStaffLog(
    newRole.guild,
    'discord-logs',
    buildDiscordLog({
      title: '⚙️ Rôle modifié',
      description: `${newRole} • \`${newRole.id}\``,
      color: 0x5865f2,
      fields: changes
    })
  );
};
