const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, ban) => {
  await sendStaffLog(
    ban.guild,
    'discord-logs',
    buildDiscordLog({
      title: '🔨 Membre banni',
      description: `${ban.user} **${ban.user.tag}**`,
      color: 0xed4245,
      fields: [
        { name: 'ID', value: `\`${ban.user.id}\``, inline: true },
        {
          name: 'Raison',
          value: ban.reason || 'Aucune raison indiquée',
          inline: false
        }
      ]
    })
  );
};
