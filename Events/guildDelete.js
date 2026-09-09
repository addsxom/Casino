const Discord = require("discord.js");
const config = require('../config/botConfig.js');

module.exports = (bot, guild) => {

    let embed = new Discord.EmbedBuilder()
     .setTitle("Partis d'un serveur !")
     .setDescription(`
     **:teddy_bear: J'ai été retiré d'un serveur :**

     > Nom :** ${guild.name}**
     > Identifiant :** ${guild.id}**
     > Créateur :** <@${guild.ownerId}>**
     > Boost :** ${guild.premiumSubscriptionCount}**
     > Créer le :** ${guild.createdAt}**
     > Nombre de server :** ${bot.guilds.cache.size}**

     **__Discord Membres__**
 
     > Membre Totaux :** ${guild.memberCount}**
     > Bot(s) :** ${guild.members.cache.filter(b => b.user.bot).size}**
     > Utilisateur(s) :** ${guild.members.cache.filter(member => !member.user.bot).size}**

         `)
     .setThumbnail(guild.iconURL())
     .setTimestamp()
     .setColor("7FB3D5")
     bot.channels.cache.get(config.channels.botGuildEvents).send({embeds: [embed] }).catch(() => false)
  } 