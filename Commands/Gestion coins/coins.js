const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');

module.exports = {
  name: 'coins',
  description: 'Affiche le solde de coins de l\'utilisateur.',
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      let targetUser = message.mentions.users.first() || message.author;

      if (args.length > 0) {
        const userId = args[0].replace(/[<@!>]/g, '');
        targetUser = await message.client.users.fetch(userId, false);
      }

      let userCoins = await UserCoins.findOne({ userId: targetUser.id, guildId });

      if (!userCoins) {
        userCoins = await UserCoins.create({ userId: targetUser.id, guildId });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
        .setDescription(`🪙 **${userCoins.coins}** coins en poche\n🏦 **${userCoins.bank}** coins en banque\n:small_red_triangle: **${userCoins.rep}** Réputation`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors de la récupération des coins.');
    }
  },
};
