const { updateMemberCount } = require('../utils/updateMemberCount.js');
const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, member) => {
  await updateMemberCount(member.guild);

  await sendStaffLog(
    member.guild,
    'server-logs',
    buildDiscordLog({
      title: '📤 Départ',
      description:
        `**${member.user.tag}** a quitté le serveur.\n` +
        `-# ${member.guild.memberCount} membres`,
      color: 0xed4245
    })
  );
};
