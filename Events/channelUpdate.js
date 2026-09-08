const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { MEMBER_COUNT_CHANNEL_ID } = require('../utils/updateMemberCount.js');

module.exports = async (_bot, oldChannel, newChannel) => {
  if (!newChannel.guild || newChannel.id === MEMBER_COUNT_CHANNEL_ID) return;

  const changes = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push(`**Nom :** ${oldChannel.name} → ${newChannel.name}`);
  }

  if (oldChannel.parentId !== newChannel.parentId) {
    changes.push(
      `**Catégorie :** ${oldChannel.parent?.name || 'Aucune'} → ${newChannel.parent?.name || 'Aucune'}`
    );
  }

  if (!changes.length) return;

  await sendStaffLog(
    newChannel.guild,
    'discord-logs',
    buildDiscordLog({
      title: '⚙️ Salon modifié',
      description: `${newChannel}\n${changes.join('\n')}`,
      color: 0x5865f2
    })
  );
};
