const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, role) => {
  await sendStaffLog(
    role.guild,
    'server-logs',
    buildDiscordLog({
      title: '➖ Rôle supprimé',
      description: `**${role.name}**`,
      color: 0xed4245
    })
  );
};
