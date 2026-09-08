const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, channel) => {
  if (!channel.guild) return;

  await sendStaffLog(
    channel.guild,
    'discord-logs',
    buildDiscordLog({
      title: '➖ Salon supprimé',
      description: `**${channel.name}**`,
      color: 0xed4245,
      fields: [
        { name: 'ID', value: `\`${channel.id}\``, inline: true },
        { name: 'Type', value: `${channel.type}`, inline: true }
      ]
    })
  );
};
