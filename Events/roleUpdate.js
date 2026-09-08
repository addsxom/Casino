const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldRole, newRole) => {
  const changes = [];

  if (oldRole.name !== newRole.name) {
    changes.push(`**Nom :** ${oldRole.name} → ${newRole.name}`);
  }

  if (oldRole.color !== newRole.color) {
    changes.push(`**Couleur :** ${oldRole.hexColor} → ${newRole.hexColor}`);
  }

  if (!changes.length) return;

  await sendStaffLog(
    newRole.guild,
    'discord-logs',
    buildDiscordLog({
      title: '⚙️ Rôle modifié',
      description: `${newRole}\n${changes.join('\n')}`,
      color: 0x5865f2
    })
  );
};
