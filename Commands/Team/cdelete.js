const Discord = require('discord.js');
const Team = require('../../Models/Team');

module.exports = {
  name: 'cdelete',
  description: 'Supprime l\'équipe actuelle',
  async execute(message) {
    try {

      const teamOwned = await Team.findOne({ ownerId: message.author.id });
      if (!teamOwned) {
        return message.reply('Vous n\'êtes propriétaire d\'aucune équipe.');
      }

      const confirmationQuestion = await message.reply('Êtes-vous sûr de vouloir supprimer votre équipe ? Répondez avec `yes` pour confirmer, ou `no` pour annuler.');
      const filter = response => ['yes', 'no'].includes(response.content.toLowerCase()) && response.author.id === message.author.id;
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });

      if (collected.first().content.toLowerCase() === 'yes') {
        await Team.deleteOne({ ownerId: message.author.id });
        return message.reply('L\'équipe a été supprimée avec succès.');
      } else {
        return message.reply('Suppression de l\'équipe annulée.');
      }
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la suppression de l\'équipe.');
    }
  },
};
