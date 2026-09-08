const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, channel) => {
  if (!channel.guild) return;

  await sendStaffLog(
    channel.guild,
    'discord-logs',
    buildDiscordLog({
      title: '➕ Salon créé',
      description: `${channel} **${channel.name}**`,
      color: 0x57f287
    })
  );
};
