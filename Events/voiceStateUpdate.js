const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');
const {
  findBotStatusChannel,
  updateBotStatusChannel
} = require('../utils/updateBotStatus.js');

module.exports = async (bot, oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;

  const member = newState.member || oldState.member;
  if (!member) return;

  if (member.id === bot.user.id) {
    const statusChannel =
      await findBotStatusChannel(member.guild);

    if (statusChannel) {
      await updateBotStatusChannel(
        member.guild,
        newState.channelId === statusChannel.id
      );
    }

    return;
  }

  if (member.user?.bot) return;

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
