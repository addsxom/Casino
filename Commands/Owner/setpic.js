const Owner = require("../../Models/Owner.js");

function restoreClientToken(client, token) {
  if (!token) return;

  client.token = token;
  client.rest.setToken(token);
}

module.exports = {
  name: "setpic",
  description: "Change la photo de profil du bot.",
  async execute(message, args) {
    const isOwner = await Owner.exists({ userId: process.env.BUYER });

    if (!isOwner) return;

    if (!args.length && !message.attachments.size) {
      return message.channel.send(
        "Veuillez fournir une URL d'image ou une image en pièce jointe pour mettre à jour la photo de profil du bot."
      );
    }

    let newAvatarURL = args[0];

    if (!newAvatarURL && message.attachments.size) {
      const attachment = message.attachments.first();
      newAvatarURL = attachment.url;
    }

    const clientToken = message.client.token || process.env.TOKEN;
    let changeError = null;

    try {
      await message.client.user.setAvatar(newAvatarURL);
    } catch (error) {
      changeError = error;
    } finally {
      // discord.js 14.19.3 peut écraser le token REST après ClientUser.edit().
      restoreClientToken(message.client, clientToken);
    }

    if (changeError) {
      if (changeError.code === 30007) {
        return message.channel.send(
          "Changement de photo de profil trop fréquent. Veuillez réessayer plus tard."
        );
      }

      console.error(
        "Erreur lors du changement de photo de profil du bot :",
        changeError
      );

      return message.channel.send(
        "❌・Impossible de mettre à jour la photo de profil du bot."
      );
    }

    return message.channel.send(
      "✅・La photo de profil du bot a été mise à jour."
    );
  },
};
