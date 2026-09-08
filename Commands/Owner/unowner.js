const Owner = require("../../Models/Owner");
const { requireBuyer } = require("../../utils/ownerPermissions.js");

module.exports = {
  name: "unowner",
  description: "Supprime un utilisateur de la liste des propriétaires du bot.",

  async execute(message, args) {
    if (!(await requireBuyer(message))) return;

    const mentionOrId = args[0];

    if (!mentionOrId) {
      return message.channel.send(
        "Veuillez mentionner un utilisateur à supprimer de la liste des propriétaires."
      );
    }

    const userId = String(mentionOrId).replace(/<@!?|>/g, "");

    if (!/^\d{17,20}$/.test(userId)) {
      return message.channel.send(
        "Veuillez mentionner un utilisateur valide ou fournir un ID Discord valide."
      );
    }

    if (userId === process.env.BUYER) {
      return message.channel.send(
        "❌・Impossible de retirer le BUYER de la liste des propriétaires."
      );
    }

    try {
      const user = message.guild?.members.cache.get(userId);
      const userName = user ? user.user.username : `<@${userId}>`;

      const existingOwner = await Owner.findOne({ userId });

      if (!existingOwner) {
        return message.channel.send(`${userName} n'était pas owner.`);
      }

      await Owner.deleteOne({ userId });

      return message.channel.send(`✅・${userName} n'est plus owner.`);
    } catch (error) {
      console.error("Erreur suppression owner :", error);
      return message.channel.send(
        "Une erreur est survenue lors de la suppression du owner."
      );
    }
  },
};
