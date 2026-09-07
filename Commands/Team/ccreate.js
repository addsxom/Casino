const Discord = require('discord.js');
const Team = require('../../Models/Team');
const TeamCoins = require('../../Models/TeamCoins');

module.exports = {
  name: 'ccreate',
  description: 'Créer une nouvelle équipe',
  async execute(message) {
    try {
      const filter = (response) => response.author.id === message.author.id;

      const existingTeam = await Team.findOne({ ownerId: message.author.id });
      if (existingTeam) {
        return message.reply('Vous êtes déjà propriétaire d\'une équipe. Utilisez d\'abord la commande `cedit` pour effectuer des modifications.');
      }

      const existingMember = await Team.findOne({ 'members.userId': message.author.id });
      if (existingMember) {
        return message.reply('Vous êtes déjà membre d\'une équipe. Utilisez d\'abord la commande `cleave` pour quitter votre équipe actuelle, puis réessayez.');
      }

      let teamName;
      let teamExists;

      do {

        const nameQuestion = await message.reply('Quel est le nom de votre équipe ?');
        const nameCollected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
        teamName = nameCollected.first().content;
        await nameQuestion.delete();
        await nameCollected.first().delete();

        teamExists = await Team.findOne({ name: teamName });
        if (teamExists) {
          const nomdejause = await message.reply(`Le nom d'équipe \`${teamName}\` est déjà pris. Veuillez choisir un autre nom.`);
          setTimeout(() => {
            nomdejause.delete();
          }, 5000);
        }
      } while (teamExists);

      const iconQuestion = await message.reply('Veuillez fournir le lien de l\'icône de votre équipe.');
      const iconCollected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
      const teamIcon = iconCollected.first().content;
      await iconQuestion.delete();
      await iconCollected.first().delete();

      const newMember = {
        userId: message.author.id,
        role: 'Leader',
        permissions: {
          manageTeam: true,
          retCoins: true,
          depCoins: true,
          addMember: true,
          removeMember: true,
        },
      };

      const newTeam = new Team({
        name: teamName,
        guildId: message.guild.id,
        ownerId: message.author.id,
        icon: teamIcon,
        timestamp: new Date(),
        members: [newMember],
      });

      await newTeam.save();

      const newTeamCoins = new TeamCoins({
        team: teamName,
        guildId: message.guild.id,
        coins: 0,
        bank: 0,
        rep: 0,
      });

      await newTeamCoins.save();

      const teamCoinsData = await TeamCoins.findOne({ team: teamName });

      const ownerMember = newTeam.members.find(member => member.role === 'Leader');
      const owner = ownerMember ? `<@${ownerMember.userId}>` : 'Non défini';

      const embed = new Discord.EmbedBuilder()
        .setTitle(teamName)
        .setDescription(
          `Owner: ${owner}\n` +
          `Coins: ${teamCoinsData.coins}\n` +
          `Bank: ${teamCoinsData.bank}\n` +
          `Rep: ${teamCoinsData.rep}\n` +
          `Membres: ${newTeam.members.length}\n` +
          `Date de création: <t:${Math.floor(newTeam.timestamp.getTime() / 1000)}:R>`
        )
        .setThumbnail(teamIcon || undefined)
        .setFooter({ text: `1/1 • ${message.client.user.username}` })
        .setColor(0x6b6de6);

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la création de l\'équipe.');
    }
  },
};
