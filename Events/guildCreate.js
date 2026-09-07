const { EmbedBuilder } = require("discord.js");
const Owner = require("../Models/Owner");

module.exports = async (bot, guild) => {
  try {
    const fetchedApplication = await guild.fetchAuditLogs({ type: '28' });
    const botAddLog = fetchedApplication.entries.first();
    const addedBy = botAddLog ? botAddLog.executor.tag : 'Inconnu';
    let embed = new EmbedBuilder()
      .setTitle("Arrivé sur un serveur !")
      .setDescription(`
      **:kite: J'ai été ajouté sur un serveur :**

      > Nom :** ${guild.name}**
      > Identifiant :** ${guild.id}**
      > Créateur :** <@${guild.ownerId}>**
      > Boost :** ${guild.premiumSubscriptionCount}**
      > Créé le :** ${guild.createdAt}**
      > Ajouté par :** ${addedBy}**
      > Nombre de server :** ${bot.guilds.cache.size}**

      **__Discord Membres__**
   
      > Membre Totaux :** ${guild.memberCount}**
      > Bot(s) :** ${guild.members.cache.filter(b => b.user.bot).size}**
      > Utilisateur(s) :** ${guild.members.cache.filter(member => !member.user.bot).size}**
    `)
      .setThumbnail(guild.iconURL())
      .setTimestamp()
      .setColor("D240F5");

    await bot.channels.cache.get('1132784655817519225').send({ embeds: [embed] }).catch(() => false);

    const diff = "``"; 
    const ownerserver = await guild.fetchOwner();
    const ownerTag = ownerserver.user.tag;

    if (!guild.members.cache.has(process.env.BUYER)) {
      const owners = await Owner.find({});
      owners.forEach(async (owner) => {
        const ownerUser = await bot.users.fetch(owner.userId);
        if (ownerUser) {
          try {
            const fetchedApplication = await guild.fetchAuditLogs({ type: '28' });
            const botAddLog = fetchedApplication.entries.first();
            const addedBy = botAddLog ? botAddLog.executor.tag : 'Inconnu';
            await ownerUser.send(`${diff}${addedBy}${diff} viens de m'inviter sur ${diff}${guild.name}${diff} (${guild.memberCount} membres, propriétaire: ${diff}${ownerTag}${diff})\nIl n'y avait pas le buyer dessus, je l'ai quitté`);
          } catch (error) {
            console.error(`Impossible d'envoyer un message privé à ${ownerUser.tag}: ${error}`);
          }
        }
      });
      await guild.leave();
    } else {
      const owners = await Owner.find({});
      owners.forEach(async (owner) => {
        const ownerUser = await bot.users.fetch(owner.userId);
        if (ownerUser) {
          try {
            const fetchedApplication = await guild.fetchAuditLogs({ type: '28' });
            const botAddLog = fetchedApplication.entries.first();
            const addedBy = botAddLog ? botAddLog.executor.tag : 'Inconnu';
            await ownerUser.send({ content: `${diff}${addedBy}${diff} viens de m'inviter sur ${diff}${guild.name}${diff} (${guild.memberCount} membres, propriétaire: ${diff}${ownerTag}${diff})` });
          } catch (error) {
            console.error(`Impossible d'envoyer un message privé à ${ownerUser.tag}: ${error}`);
          }
        }
      });
      console.log(`je vien d'etre inviter sur ${guild.name} (${guild.memberCount} membres, propriétaire: ${ownerTag}}) par ${addedBy}`);
    }
  } catch (error) {
    console.error(`Erreur lors de l'envoi du message privé : ${error}`);
  }
};
