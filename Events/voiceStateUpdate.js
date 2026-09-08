const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member || oldState.member;
  if (!member || member.user?.bot) return;

  let title;
  let description;

  if (!oldState.channelId && newState.channelId) {
    title = '🎙️ Vocal rejoint';
    description = `${member} → ${newState.channel}`;
  } else if (oldState.channelId && !newState.channelId) {
    title = '🎙️ Vocal quitté';
    description = `${member} ← ${oldState.channel}`;
  } else {
    title = '🎙️ Vocal déplacé';
    description = `${member}\n${oldState.channel} → ${newState.channel}`;
  }

  await sendStaffLog(
    member.guild,
    'voice-logs',
    buildDiscordLog({
      title,
      description,
      color: 0x5865f2
    })
  );
};
