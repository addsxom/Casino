const ServerPrefix = require("../../Models/ServerPrefix");

const { requireBotOwner } = require('../../utils/ownerPermissions.js');
const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: "setprefix",
  description: "Définir le préfixe du bot pour ce serveur.",
  async execute(message, args) {
    const server = message.guild;
    if (!server) return;
    if (!(await requireBotOwner(message))) return;

const newPrefix = args[0];

    if (!newPrefix) {
      return message.channel.send(replyEmbedPayload("Veuillez fournir un nouveau préfixe.", { type: "error" }));
    }

    if (!message.guild) {
      return message.channel.send(
        replyEmbedPayload(
          "Cette commande ne peut être utilisée que dans un serveur.",
          { type: 'error' }
        )
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
        replyEmbedPayload(
          `Le préfixe du bot pour ce serveur a été défini sur \`${newPrefix}\`.`,
          { type: 'success', title: '⌨️ Préfixe modifié' }
        )
      );
    } catch (error) {
      console.error(error);
      message.channel.send(
        replyEmbedPayload(
          "Une erreur s'est produite lors de la définition du préfixe.",
          { type: 'error' }
        )
      );
    }
  },
};
