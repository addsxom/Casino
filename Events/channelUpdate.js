const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { MEMBER_COUNT_CHANNEL_ID } = require('../utils/updateMemberCount.js');

module.exports = async (_bot, oldChannel, newChannel) => {
  if (!newChannel.guild || newChannel.id === MEMBER_COUNT_CHANNEL_ID) return;

  const changes = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push({
      name: 'Nom',
      value: `${oldChannel.name} → ${newChannel.name}`,
      inline: false
    });
  }

  if (oldChannel.parentId !== newChannel.parentId) {
    changes.push({
      name: 'Catégorie',
      value: `${oldChannel.parent?.name || 'Aucune'} → ${newChannel.parent?.name || 'Aucune'}`,
      inline: false
    });
  }

  if (!changes.length) return;

  await sendStaffLog(
    newChannel.guild,
    'discord-logs',
    buildDiscordLog({
      title: '⚙️ Salon modifié',
      description: `${newChannel} • \`${newChannel.id}\``,
      color: 0x5865f2,
      fields: changes
    })
  );
};
