const Owner = require("../../Models/Owner");

module.exports = {
  name: "unowner",
  description: "Supprime un utilisateur de la liste des propriétaires du bot.",
  async execute(message, args) {
    const buyerId = message.author.id;

    if (buyerId === process.env.BUYER) {
      const mentionOrId = args[0];
      if (!mentionOrId) {
        return message.channel.send(
          "Veuillez mentionner un utilisateur à supprimer de la liste des propriétaires."
        );
      }

      const userId = mentionOrId.replace(/<@|>/g, "");

      if (userId === process.env.BUYER) {
        return message.channel.send(
          "Impossible de supprimer cette personne de la liste des propriétaires."
        );
      }

      try {
        const user = message.guild.members.cache.get(userId);
        const userName = user ? user.user.username : `<@${userId}>`;

        const existingOwner = await Owner.findOne({ userId });
        if (!existingOwner) {
          return message.channel.send(`${userName} n'était pas owner.`);
        }

        await Owner.deleteOne({ userId });
        message.channel.send(`${userName} n'est plus owner.`);
      } catch (error) {
        console.error(error);
        message.channel.send(
          "Une erreur est survenue lors de la suppression du owner."
        );
      }
    } else {
      return message.channel.send(
        "Vous n'avez pas la permission de supprimer un utilisateur de la liste des propriétaires."
      );
    }
  },
};
