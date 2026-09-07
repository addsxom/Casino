const Discord = require('discord.js');
const Team = require('../../Models/Team');
const TeamCoins = require('../../Models/TeamCoins');

module.exports = {
  name: 'cinfo',
  description: 'Affiche les informations de l\'équipe',
  async execute(message, args) {
    try {
      let targetUserId = message.author.id;

      if (args.length > 0) {
        const targetUser = message.mentions.users.first();
        if (targetUser) {
          targetUserId = targetUser.id;
        } else {
          const userId = args[0].replace(/\D/g, '');
          if (userId) {
            targetUserId = userId;
          }
        }
      }

      const teamOwned = await Team.findOne({ ownerId: targetUserId });
      if (teamOwned) {
        return displayTeamInfo(message, teamOwned);
      }

      const teamMember = await Team.findOne({ 'members.userId': targetUserId });
      if (teamMember) {
        return displayTeamInfo(message, teamMember);
      }

      return message.reply('L\'utilisateur n\'est ni propriétaire ni membre d\'une équipe.');
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la récupération des informations de l\'équipe.');
    }
  },
};

async function displayTeamInfo(message, team) {
  const teamCoinsData = await TeamCoins.findOne({ team: team.name });
  

  const ownerMember = team.members.find(member => member.role === 'Leader');
  const owner = ownerMember ? `<@${ownerMember.userId}>` : 'Non défini';

  const embed = new Discord.EmbedBuilder()
    .setTitle("Information sur la team "+ team.name)
    .setDescription(
      `Owner: ${owner}\n` +
      `Coins: ${teamCoinsData.coins}\n` +
      `Coins en Bank: ${teamCoinsData.bank}\n` +
      `Rep: ${teamCoinsData.rep}\n` +
      `Nombre total de membres: ${team.members.length}\n` +
      `Date de création: <t:${Math.floor(team.timestamp.getTime() / 1000)}:R>`
    )
    .setThumbnail(team.icon || undefined)
    .setFooter({ text: `1/1 • ${message.client.user.username}` })
    .setColor(0x6b6de6);

  return message.channel.send({ embeds: [embed] });
}
