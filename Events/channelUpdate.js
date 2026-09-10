const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const {
  getMemberCountChannelId
} = require('../utils/updateMemberCount.js');
const { AuditLogEvent, getRecentAuditExecutor } = require('../utils/auditLogs.js');

module.exports = async (_bot, oldChannel, newChannel) => {
  if (
    !newChannel.guild ||
    newChannel.id ===
      getMemberCountChannelId(
        newChannel.guild.id
      )
  ) {
    return;
  }

  const changes = [];

  if (oldChannel.name !== newChannel.name) {
    changes.push(`**Nom :** ${oldChannel.name} → ${newChannel}`);
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
        (oldChannel.name !== newChannel.name
          ? ''
          : `${newChannel}\n`) +
        `${changes.join('\n')}\n` +
        `-# Modifié par ${executor || 'Inconnu'}`,
      color: 0x5865f2
    })
  );
};
