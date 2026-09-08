const Owner = require("../../Models/Owner.js");

function restoreClientToken(client, token) {
  if (!token) return;

  client.token = token;
  client.rest.setToken(token);
}

module.exports = {
  name: "setname",
  description: "Change le nom du bot.",
  async execute(message, args) {
    const isOwner = await Owner.exists({ userId: process.env.BUYER });

    if (!isOwner) return;

    if (!args.length) {
      return message.channel.send(
        "Veuillez fournir un nouveau nom pour le bot."
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
          "Changement de nom trop fréquent. Veuillez réessayer plus tard."
        );
      }

      console.error(
        "Erreur lors du changement de nom du bot :",
        changeError
      );

      return message.channel.send(
        "❌・Impossible de changer le nom du bot."
      );
    }

    return message.channel.send(
      `✅・Le nom du bot a été changé en : ${newBotName}`
    );
  },
};
