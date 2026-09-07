const Discord = require("discord.js");
const Owner = require("../../Models/Owner");

module.exports = {
  name: "owner",
  description: "Gère la liste des propriétaires du bot.",
  async execute(message, args) {
    if (!args[0]) {
      return listOwners(message);
    } else {
      return addOwner(message, args[0]);
    }
  },
};

async function addOwner(message, mentionOrId) {
  const isOwner =
    process.env.BUYER || (await Owner.exists({ userId: process.env.BUYER }));

  if (!isOwner) return;

  const userId = mentionOrId.replace(/<@|>/g, "");

  try {
    const user = message.mentions.members.first();
    const userName = user ? user.user.username : `<@${userId}>`;

    if (userId === process.env.BUYER) {
      return message.channel.send(`${userName} est déjà owner.`);
    }

    const existingOwner = await Owner.findOne({ userId });
    if (existingOwner) {
      return message.channel.send(`${userName} est déjà owner.`);
    }

    await Owner.create({ userId });

    message.channel.send(`${userName} est maintenant owner.`);
  } catch (error) {
    console.error(error);
    message.channel.send("Une erreur est survenue lors de l'ajout du owner.");
  }
}

async function listOwners(message) {
  const isOwner =
    process.env.BUYER || (await Owner.exists({ userId: process.env.BUYER }));

  if (!isOwner) return;

  try {
    const owners = await Owner.find();

    if (owners.length === 0) {
      return message.channel.send(
        "Il n'y a actuellement aucun owner enregistré."
      );
    }

    const ownerMentions = owners
      .map((owner) => `<@${owner.userId}>`)
      .join("\n");

    const embed = new Discord.EmbedBuilder()
      .setTitle("Owners")
      .setDescription(ownerMentions)
      .setFooter({ text: `1/1 • ${message.client.user.username}` })
      .setColor( 0x6b6de6)
    message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    message.channel.send(
      "Une erreur est survenue lors de la récupération de la liste des owner."
    );
  }
}
