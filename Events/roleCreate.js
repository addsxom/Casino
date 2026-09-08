const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, role) => {
  await sendStaffLog(
    role.guild,
    'server-logs',
    buildDiscordLog({
      title: '➕ Rôle créé',
      description: `${role} **${role.name}**`,
      color: 0x57f287
    })
  );
};
