const { updateMemberCount } = require('../utils/updateMemberCount.js');
const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, member) => {
  await updateMemberCount(member.guild);

  await sendStaffLog(
    member.guild,
    'discord-logs',
    buildDiscordLog({
      title: '📤 Membre parti',
      description: `**${member.user.tag}** a quitté le serveur.`,
      color: 0xed4245,
      fields: [
        { name: 'ID', value: `\`${member.id}\``, inline: true },
        { name: 'Membres', value: `${member.guild.memberCount}`, inline: true }
      ]
    })
  );
};
