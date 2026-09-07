// const { ActivityType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
// const mongoose = require('mongoose');
// const BotInfo  = require('../../Models/BotInfo');

// module.exports = {
//   name: 'editbot',
//   description: 'Modifier les informations du bot',
//   async execute(message, args, bot) {
//     try {
//       // Vérifier la connexion à la base de données
//       if (!mongoose.connection.readyState) {
//         return message.reply('La connexion à la base de données n\'est pas établie.');
//       }

//       let botInfo = await BotInfo.findOne({ guildId: message.guild.id });

//       if (!botInfo) {
//         botInfo = {
//           botName: message.client.user.username,
//           activityType: ActivityType[message.client.user.presence.activities[0]?.type] || 'LISTENING',
//           avatarURL: message.client.user.displayAvatarURL(),
//           status: message.client.user.presence.status,
//         };

//         await BotInfo.create({
//           guildId: message.guild.id,
//           ...botInfo,
//         });
//       }

//       const [, field, value] = args;

//       if (!field && !value) {
//         // Afficher un select menu avec les options disponibles
//         const selectMenu = new StringSelectMenuBuilder()
//           .setCustomId('editInfo')
//           .setPlaceholder('Choisissez un champ à modifier')
//           .addOptions([
//             { label: 'Nom du bot', value: 'botName' },
//             { label: 'Activité', value: 'activity' },
//             { label: 'Avatar', value: 'avatar' },
//             { label: 'Statut', value: 'status' },
//           ]);

//         const row = new ActionRowBuilder().addComponents(selectMenu);

//         const currentInfoEmbed = createInfoEmbed(botInfo);

//         return message.reply({ embeds: [currentInfoEmbed], components: [row] });
//       }

//       // Modifier le champ sélectionné
//       switch (field.toLowerCase()) {
//         case 'botname':
//           botInfo.botName = value;
//           break;
//         case 'activity':
//           botInfo.activityType = value.toUpperCase();
//           break;
//         case 'avatar':
//           botInfo.avatarURL = value;
//           break;
//         case 'status':
//           botInfo.status = value.toLowerCase();
//           break;
//         default:
//           return message.reply('Champ invalide. Utilisez l\'un des suivants : botname, activity, avatar, status.');
//       }

//       if (!botInfo._id) {
//         // Si le modèle n'existe pas dans la base de données, créez-le
//         await BotInfo.create({
//           guildId: message.guild.id,
//           ...botInfo,
//         });
//       } else {
//         await BotInfo.updateOne({ guildId: message.guild.id }, botInfo);
//       }

//       // Appliquer les modifications
//       const bot = message.client;
//       bot.user.setUsername(botInfo.botName);
//       bot.user.setActivity(botInfo.botName, { type: ActivityType[botInfo.activityType] });
//       bot.user.setAvatar(botInfo.avatarURL);
//       bot.user.setStatus(botInfo.status);

//       const updatedInfoEmbed = createInfoEmbed(botInfo);
//       message.reply({ content: 'Informations mises à jour avec succès:', embeds: [updatedInfoEmbed] });
//     } catch (error) {
//       console.error(error);
//       return message.reply('Une erreur s\'est produite lors de la modification des informations du bot.');
//     }
//   },
// };

// // Fonction pour créer un embed d'informations
// function createInfoEmbed(botInfo) {
//   // Créer un embed avec les informations actuelles
//   return new EmbedBuilder()
//     .setTitle('Informations du bot')
//     .setThumbnail(bot.user.displayAvatarURL({ dynamic: true }))
//     .setDescription(`Nom du bot:\n${botInfo.botName}\nActivité:\n${botInfo.activityType}\nStatut:\n${botInfo.status}`);
// }

const { ActivityType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require("discord.js");
const mongoose = require('mongoose');
const BotInfo  = require('../../Models/BotInfo');

module.exports = {
  name: 'editbot',
  description: 'Modifier les informations du bot',
  async execute(message, args) {
    try {
      // Vérifier la connexion à la base de données
      if (!mongoose.connection.readyState) {
        return message.reply('La connexion à la base de données n\'est pas établie.');
      }

      let botInfo = await BotInfo.findOne({ guildId: message.guild.id });

      if (!botInfo) {
        botInfo = {
          botName: message.client.user.username,
          activityType: ActivityType[message.client.user.presence.activities[0]?.type] || 'LISTENING',
          avatarURL: message.client.user.displayAvatarURL(),
          status: message.client.user.presence.status,
        };

        await BotInfo.create({
          guildId: message.guild.id,
          ...botInfo,
        });
      }

      const [, field, value] = args;

      if (!field && !value) {
        // Afficher un select menu avec les options disponibles
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('editInfo')
          .setPlaceholder('Choisissez un champ à modifier')
          .addOptions([
            { label: 'Nom du bot', value: 'botName' },
            { label: 'Activité', value: 'activity' },
            { label: 'Avatar', value: 'avatar' },
            { label: 'Statut', value: 'status' },
          ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const currentInfoEmbed = createInfoEmbed(botInfo, message.client);

        return message.reply({ embeds: [currentInfoEmbed], components: [row] });
      }

      // Modifier le champ sélectionné
      switch (field.toLowerCase()) {
        case 'botname':
          botInfo.botName = value;
          break;
        case 'activity':
          botInfo.activityType = value.toUpperCase();
          break;
        case 'avatar':
          botInfo.avatarURL = value;
          break;
        case 'status':
          botInfo.status = value.toLowerCase();
          break;
        default:
          return message.reply('Champ invalide. Utilisez l\'un des suivants : botname, activity, avatar, status.');
      }

      if (!botInfo._id) {
        // Si le modèle n'existe pas dans la base de données, créez-le
        await BotInfo.create({
          guildId: message.guild.id,
          ...botInfo,
        });
      } else {
        await BotInfo.updateOne({ guildId: message.guild.id }, botInfo);
      }

      // Appliquer les modifications
      const bot = message.client;
      bot.user.setUsername(botInfo.botName);
      bot.user.setActivity(botInfo.botName, { type: ActivityType[botInfo.activityType] });
      bot.user.setAvatar(botInfo.avatarURL);
      bot.user.setStatus(botInfo.status);

      const updatedInfoEmbed = createInfoEmbed(botInfo, bot);
      message.reply({ content: 'Informations mises à jour avec succès:', embeds: [updatedInfoEmbed] });
    } catch (error) {
      console.error(error);
      return message.reply('Une erreur s\'est produite lors de la modification des informations du bot.');
    }
  },
};

// Fonction pour créer un embed d'informations
function createInfoEmbed(botInfo, bot) {
  const diff = "``"; 
  // Créer un embed avec les informations actuelles
  return new EmbedBuilder()
    .setTitle('Informations du bot')
    .setThumbnail(bot.user.displayAvatarURL({ dynamic: true }))
    .setDescription(`**Nom du bot:**\n${diff}${botInfo.botName}${diff}\n**Activité:**\n${diff}${botInfo.activityType}${diff}\n**Text:**\n${diff}${botInfo.activityText}${diff},${diff}${botInfo.activityText2}${diff}\n**Statut:**\n${diff}${botInfo.status}${diff}`);
}
