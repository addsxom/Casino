const { updateMemberCount } = require('../utils/updateMemberCount.js');
const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, member) => {
  await updateMemberCount(member.guild);

  await sendStaffLog(
    member.guild,
    'discord-logs',
    buildDiscordLog({
      title: '📥 Arrivée',
      description:
        `${member.user} a rejoint le serveur.\n` +
        `-# ${member.guild.memberCount} membres • Compte créé <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
      color: 0x57f287
    })
  );
};
