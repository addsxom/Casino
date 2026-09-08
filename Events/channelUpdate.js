const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const { MEMBER_COUNT_CHANNEL_ID } = require('../utils/updateMemberCount.js');
const { AuditLogEvent, getRecentAuditExecutor } = require('../utils/auditLogs.js');

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

  const executor = await getRecentAuditExecutor(
    newChannel.guild,
    AuditLogEvent.ChannelUpdate,
    { targetId: newChannel.id }
  );

  await sendStaffLog(
    newChannel.guild,
    'server-logs',
    buildDiscordLog({
      title: '⚙️ Salon modifié',
      description:
        `${newChannel}\n` +
        `${changes.join('\n')}\n` +
        `-# Modifié par ${executor || 'Inconnu'}`,
      color: 0x5865f2
    })
  );
};
