
function restoreClientToken(client, token) {
  if (!token) return;

  client.token = token;
  client.rest.setToken(token);
}

const { requireBotOwner } = require('../../utils/ownerPermissions.js');
const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: "setname",
  description: "Change le nom du bot.",
  async execute(message, args) {
    if (!(await requireBotOwner(message))) return;

if (!args.length) {
      return message.channel.send(
        replyEmbedPayload(
          "Veuillez fournir un nouveau nom pour le bot.",
          { type: 'error' }
        )
      );
    }

    const newBotName = args.join(" ");
    const clientToken = message.client.token || process.env.TOKEN;
    let changeError = null;

    try {
      await message.client.user.setUsername(newBotName);
    } catch (error) {
      changeError = error;
    } finally {
      // Même protection que setpic : ClientUser.edit() peut vider le token REST.
      restoreClientToken(message.client, clientToken);
    }

    if (changeError) {
      if (changeError.code === 30029) {
        return message.channel.send(
          replyEmbedPayload(
            "Changement de nom trop fréquent. Veuillez réessayer plus tard.",
            { type: 'warning' }
          )
        );
      }

      console.error(
        "Erreur lors du changement de nom du bot :",
        changeError
      );

      return message.channel.send(
        replyEmbedPayload(
          "Impossible de changer le nom du bot.",
          { type: 'error' }
        )
      );
    }

    return message.channel.send(
      replyEmbedPayload(
        `Le nom du bot a été changé en : **${newBotName}**`,
        { type: 'success', title: '🤖 Nom du bot modifié' }
      )
    );
  },
};
