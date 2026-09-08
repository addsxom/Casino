const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const {
  AuditLogEvent,
  getRecentAuditExecutor
} = require('../utils/auditLogs.js');

module.exports = async (_bot, oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member || oldState.member;
  if (!member || member.user?.bot) return;

  let title;
  let description;
  let color;

  if (!oldState.channelId && newState.channelId) {
    title = '🟢 Vocal rejoint';
    description =
      `${member} a rejoint ${newState.channel}.`;
    color = 0x57f287;
  } else if (oldState.channelId && !newState.channelId) {
    title = '🔴 Vocal quitté';
    description =
      `${member} a quitté ${oldState.channel}.`;
    color = 0xed4245;
  } else {
    const executor = await getRecentAuditExecutor(
      member.guild,
      AuditLogEvent.MemberMove,
      {
        channelId: newState.channelId,
        withinMs: 8000,
        delayMs: 1000
      }
    );

    title = '🟡 Vocal déplacé';
    description =
      `${member}\n` +
      `${oldState.channel} → ${newState.channel}\n` +
      (executor
        ? `-# Déplacé par ${executor}`
        : '-# Déplacement effectué par le membre');

    color = 0xfee75c;
  }

  await sendStaffLog(
    member.guild,
    'voice-logs',
    buildDiscordLog({
      title,
      description,
      color
    })
  );
};
