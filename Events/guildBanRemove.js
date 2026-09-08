const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, ban) => {
  await sendStaffLog(
    ban.guild,
    'discord-logs',
    buildDiscordLog({
      title: '🔓 Membre débanni',
      description: `${ban.user} **${ban.user.tag}**`,
      color: 0x57f287,
      fields: [
        { name: 'ID', value: `\`${ban.user.id}\``, inline: true }
      ]
    })
  );
};
