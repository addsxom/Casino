const { updateMemberCount } = require('../utils/updateMemberCount.js');
const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, member) => {
  await updateMemberCount(member.guild);

  await sendStaffLog(
    member.guild,
    'discord-logs',
    buildDiscordLog({
      title: '📥 Membre arrivé',
      description: `${member.user} **${member.user.tag}** a rejoint le serveur.`,
      color: 0x57f287,
      fields: [
        { name: 'ID', value: `\`${member.id}\``, inline: true },
        { name: 'Membres', value: `${member.guild.memberCount}`, inline: true },
        {
          name: 'Compte créé',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true
        }
      ]
    })
  );
};
