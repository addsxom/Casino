const Discord = require("discord.js");
const Owner = require("../../Models/Owner");
const { requireBotOwner, requireBuyer } = require("../../utils/ownerPermissions.js");

module.exports = {
  name: "owner",
  description: "Gère la liste des propriétaires du bot.",
  async execute(message, args) {
    if (!args[0]) {
      if (!(await requireBotOwner(message))) return;
      return listOwners(message);
    }

    if (!(await requireBuyer(message))) return;
    return addOwner(message, args[0]);
  },
};

async function addOwner(message, mentionOrId) {
  const userId = String(mentionOrId).replace(/<@!?|>/g, "");

  if (!/^\d{17,20}$/.test(userId)) {
    return message.channel.send("Veuillez mentionner un utilisateur valide ou fournir un ID Discord valide.");
  }

  try {
    const user = message.mentions.members.first();
    const userName = user ? user.user.username : `<@${userId}>`;

    if (userId === process.env.BUYER) {
      return message.channel.send(`${userName} est déjà le BUYER du bot.`);
    }

    const existingOwner = await Owner.findOne({ userId });
    if (existingOwner) {
      return message.channel.send(`${userName} est déjà owner.`);
    }

    await Owner.create({ userId });
    return message.channel.send(`✅・${userName} est maintenant owner.`);
  } catch (error) {
    console.error("Erreur ajout owner :", error);
    return message.channel.send("Une erreur est survenue lors de l'ajout du owner.");
  }
}

async function listOwners(message) {
  try {
    const owners = await Owner.find();
    const ownerIds = new Set(owners.map(owner => owner.userId));

    if (process.env.BUYER) {
      ownerIds.add(process.env.BUYER);
    }

    if (ownerIds.size === 0) {
      return message.channel.send("Il n'y a actuellement aucun owner enregistré.");
    }

    const ownerMentions = [...ownerIds]
      .map(userId =>
        userId === process.env.BUYER
          ? `<@${userId}> — **BUYER**`
          : `<@${userId}>`
      )
      .join("\n");

    const embed = new Discord.EmbedBuilder()
      .setTitle("Owners")
      .setDescription(ownerMentions)
      .setFooter({ text: `1/1 • ${message.client.user.username}` })
      .setColor(0x6b6de6);

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Erreur liste owners :", error);
    return message.channel.send("Une erreur est survenue lors de la récupération de la liste des owners.");
  }
}
