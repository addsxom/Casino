const Discord = require('discord.js');
const Team = require('../../Models/Team');

module.exports = {
    name: 'cacc',
    description: 'Accepter une invitation dans l\'équipe',
    async execute(message) {
        try {
            // Vérifier si l'auteur de la commande est dans une équipe
            const teamMember = await Team.findOne({ ownerId: message.author.id });
            if (!teamMember) {
                return message.reply('Vous n\'êtes pas dans une équipe.');
            }

            // Récupérer l'invitation de la base de données
            const invitation = teamMember.invitations.find(inv => inv.inviterId === message.author.id);
            if (!invitation) {
                return message.reply('Vous n\'avez aucune invitation en attente.');
            }

            // Supprimer l'invitation de la base de données
            await Team.updateOne({ ownerId: message.author.id }, { $pull: { invitations: { inviterId: message.author.id } } });

            // Ajouter l'utilisateur à l'équipe
            await Team.updateOne({ ownerId: message.author.id }, { $push: { members: { userId: message.author.id } } });

            return message.reply(`Vous avez rejoint la team ${invitation.teamName}.`);
        } catch (error) {
            console.error(error);
            return message.reply('Une erreur s\'est produite lors de l\'acceptation de l\'invitation.');
        }
    },
};
