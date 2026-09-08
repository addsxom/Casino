const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member || oldState.member;
  if (!member || member.user?.bot) return;

  let title = '🎙️ Vocal';
  let description = '';

  if (!oldState.channelId && newState.channelId) {
    title = '🎙️ Vocal rejoint';
    description = `${member} a rejoint ${newState.channel}.`;
  } else if (oldState.channelId && !newState.channelId) {
    title = '🎙️ Vocal quitté';
    description = `${member} a quitté ${oldState.channel}.`;
  } else {
    title = '🎙️ Vocal déplacé';
    description = `${member} : ${oldState.channel} → ${newState.channel}`;
  }

  await sendStaffLog(
    member.guild,
    'discord-logs',
    buildDiscordLog({
      title,
      description,
      color: 0x5865f2,
      fields: [
        { name: 'ID', value: `\`${member.id}\``, inline: true }
      ]
    })
  );
};
