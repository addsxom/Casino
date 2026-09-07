const Owner = require("../../Models/Owner.js");

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

    try {
      await message.client.user.setUsername(newBotName);
      message.channel.send(`Le nom du bot a été changé en : ${newBotName}`);
    } catch (error) {
      if (error.code === 30029) {
        message.channel.send(
          "Changement de nom trop fréquent. Veuillez réessayer plus tard."
        );
      } else {
        console.error("Erreur lors du changement de nom du bot :", error);
      }
    }
  },
};
