const Discord = require('discord.js');
const Team = require('../../Models/Team');

module.exports = {
    name: 'cinvite',
    description: 'Inviter un membre dans l\'équipe',
    async execute(message, args) {
        try {
            // Vérifier si l'auteur de la commande est dans une équipe
            const teamSender = await Team.findOne({ ownerId: message.author.id });
            if (!teamSender) {
                return message.reply('Vous devez être dans une équipe pour pouvoir inviter des membres.');
            }

            // Vérifier si l'auteur de la commande est le propriétaire de l'équipe
            if (teamSender.ownerId !== message.author.id) {
                return message.reply('Vous n\'avez pas les permissions nécessaires pour inviter un membre.');
            }

            // Vérifier si la mention de l'utilisateur à inviter est fournie
            const targetUser = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);

            if (!targetUser) {
                return message.reply('Veuillez mentionner un utilisateur valide.');
            }

            // Vérifier si l'utilisateur à inviter est dans une équipe
            const teamTarget = await Team.findOne({ ownerId: targetUser.id });
            if (teamTarget) {
                return message.reply(`${targetUser.tag} est déjà dans une équipe.`);
            }

            // Envoyer l'invitation dans le salon actuel
            const inviteMessage = await message.channel.send(`<@${targetUser.id}> vous avez été invité dans la team ${teamSender.name} par ${message.author.tag}. Vous avez 5 minutes pour accepter l'invitation.`);

            // Stocker l'invitation dans la base de données
            await Team.updateOne({ ownerId: targetUser.id }, { $push: { invitations: { inviterId: message.author.id, teamName: teamSender.name, message: inviteMessage.id } } });

            // Supprimer l'invitation après 5 minutes
            setTimeout(async () => {
                const updatedTeam = await Team.findOne({ ownerId: targetUser.id });
                const invitation = updatedTeam.invitations.find(inv => inv.message === inviteMessage.id);
                if (invitation) {
                    await Team.updateOne({ ownerId: targetUser.id }, { $pull: { invitations: { message: inviteMessage.id } } });
                    inviteMessage.edit(`L'invitation de ${message.author.tag} dans la team ${teamSender.name} a expiré.`);
                }
            }, 300000); // 5 minutes

            return;
        } catch (error) {
            console.error(error);
            return message.reply('Une erreur s\'est produite lors de l\'invitation du membre.');
        }
    },
};
