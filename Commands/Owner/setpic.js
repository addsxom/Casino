const Owner = require("../../Models/Owner.js");

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

    try {
      await message.client.user.setAvatar(newAvatarURL);
      message.channel.send("La photo de profil du bot a été mise à jour.");
    } catch (error) {
      if (error.code === 30007) {
        message.channel.send(
          "Changement de photo de profil trop fréquent. Veuillez réessayer plus tard."
        );
      } else {
        console.error(
          "Erreur lors du changement de photo de profil du bot :",
          error
        );
      }
    }
  },
};
