const Discord = require('discord.js');
const Team = require('../../Models/Team');
const TeamCoins = require('../../Models/TeamCoins');

module.exports = {
  name: 'cedit',
  description: 'Modifier les informations de l\'équipe',
  async execute(message) {
    try {

      const teamOwned = await Team.findOne({ ownerId: message.author.id });
      if (!teamOwned) {
        return message.reply('Vous n\'êtes propriétaire d\'aucune équipe.');
      }

      const teamCoinsData = await TeamCoins.findOne({ team: teamOwned.name });

      const embed = new Discord.EmbedBuilder()
        .setTitle(`Informations de l'équipe - ${teamOwned.name}`)
        .setDescription(`Owner: <@${teamOwned.ownerId}>\nCoins: ${teamCoinsData.coins}\nBank: ${teamCoinsData.bank}\nRep: ${teamCoinsData.rep}\nDate de création: <t:${Math.floor(teamOwned.timestamp.getTime() / 1000)}:R>`)
        .setThumbnail(teamOwned.icon || undefined)
        .setColor(0x6b6de6);

      const selectMenu = new Discord.StringSelectMenuBuilder()
        .setCustomId('editOptions')
        .setPlaceholder('Sélectionnez une option')
        .addOptions([
          {
            label: 'Nom de l\'équipe',
            value: 'editName',
          },
          {
            label: 'Icône de l\'équipe',
            value: 'editIcon',
          },
          {
            label: 'Permissions des rôles',
            value: 'editPermissions',
          },
        ]);

      const row = new Discord.ActionRowBuilder().addComponents(selectMenu);
      const editQuestion = await message.reply({ embeds: [embed], components: [row] });

      const filter = interaction => interaction.customId === 'editOptions' && interaction.user.id === message.author.id;
      const collector = message.channel.createMessageComponentCollector({ filter, time: 30000 });

      collector.on('collect', async interaction => {
        const selectedOption = interaction.values[0];
        await interaction.deferUpdate();

        switch (selectedOption) {
          case 'editName':

            detachedMessage = await message.channel.send('Entrez le nouveau nom de l\'équipe:');
            const nameCollected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
            const newName = nameCollected.first().content;
            await detachedMessage.delete();

            await Team.updateOne({ ownerId: message.author.id }, { name: newName });
            await TeamCoins.updateOne({ team: teamOwned.name }, { team: newName });
            await nameCollected.first().delete();

            embed.setTitle(`Informations de l'équipe - ${newName}`);
            break;

          case 'editIcon':

            detachedMessage = await message.channel.send('Entrez le nouveau lien d\'icône de l\'équipe:');
            const iconCollected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
            const newIcon = iconCollected.first().content;
            await detachedMessage.delete();

            await Team.updateOne({ ownerId: message.author.id }, { icon: newIcon });
            await iconCollected.first().delete();

            embed.setThumbnail(newIcon || undefined);
            break;

          case 'editPermissions':

            const teamRoles = teamOwned.members.map(member => member.role);

            const permOptions = teamRoles.map(role => ({
              label: role,
              value: role,
            }));

            const roleSelectMenu = new Discord.StringSelectMenuBuilder()
              .setCustomId('editRole')
              .setPlaceholder('Sélectionnez un rôle')
              .addOptions(permOptions);

            const roleRow = new Discord.ActionRowBuilder().addComponents(roleSelectMenu);
            await message.channel.send({ content: 'Sélectionnez le rôle à modifier:', components: [roleRow] });

            const roleFilter = m => m.customId === 'editRole' && m.user.id === message.author.id;
            const roleCollector = message.channel.createMessageComponentCollector({ filter: roleFilter, time: 30000 });

            let selectedRole;

            roleCollector.on('collect', async roleInteraction => {
              selectedRole = roleInteraction.values[0];
              await roleInteraction.deferUpdate();
              roleCollector.stop();
            });

            roleCollector.on('end', async collected => {
              if (collected.size === 0) {
                await message.channel.send('Le temps imparti pour la sélection du rôle a expiré.');
                return;
              }

              const permCollected = await message.channel.awaitMessages({ filter: m => m.author.id === message.author.id, max: 1, time: 30000, errors: ['time'] });
              const newPerms = permCollected.first().content;

              await Team.updateOne(
                { ownerId: message.author.id, 'members.role': selectedRole },
                { $set: { 'members.$.permissions': newPerms } }
              );

              await permCollected.first().delete();
              await message.channel.send(`Les permissions pour le rôle \`${selectedRole}\` ont été mises à jour.`);

              const roleIndex = teamOwned.members.findIndex(member => member.role === selectedRole);
              if (roleIndex !== -1) {
                teamOwned.members[roleIndex].permissions = newPerms;
              }
            });

            break;

          default:
            break;
        }

        await editQuestion.edit({ embeds: [embed], components: [row] });
        const msgconfirmation = await message.reply('Modification effectuée avec succès.');
        setTimeout(() => {
          msgconfirmation.delete();
        }, 5000);
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          editQuestion.delete();
          message.reply('Le temps imparti pour la sélection a expiré.');
        }
      });
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la modification des informations de l\'équipe.');
    }
  },
};
