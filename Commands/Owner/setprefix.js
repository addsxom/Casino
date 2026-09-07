const ServerPrefix = require("../../Models/ServerPrefix");
const Owner = require("../../Models/Owner.js");

module.exports = {
  name: "setprefix",
  description: "Définir le préfixe du bot pour ce serveur.",
  async execute(message, args) {
    const server = message.guild;
    if (!server) return;

    const isOwner = await Owner.exists({ userId: process.env.BUYER });

    if (!isOwner) return;

    const newPrefix = args[0];

    if (!newPrefix) {
      return message.channel.send("Veuillez fournir un nouveau préfixe.");
    }

    if (!message.guild) {
      return message.channel.send(
        "Cette commande ne peut être utilisée que dans un serveur."
      );
    }

    const guildId = message.guild.id;

    try {
      let serverPrefix = await ServerPrefix.findOne({ guildId });

      if (!serverPrefix) {
        serverPrefix = new ServerPrefix({
          guildId,
          prefix: newPrefix,
        });
      } else {
        serverPrefix.prefix = newPrefix;
      }

      await serverPrefix.save();

      message.channel.send(
        `Le préfixe du bot pour ce serveur a été défini sur \`${newPrefix}\`.`
      );
    } catch (error) {
      console.error(error);
      message.channel.send(
        "Une erreur s'est produite lors de la définition du préfixe."
      );
    }
  },
};
