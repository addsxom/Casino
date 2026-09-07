const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');

module.exports = {
  name: 'rob',
  description: 'Volez des coins à un utilisateur.',
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const targetUser = message.mentions.users.first() || message.client.users.cache.get(args[0]);

      if (!targetUser) {
        return message.reply('Veuillez mentionner un utilisateur à rob.');
      }

      let userCoins = await UserCoins.findOne({ userId: message.author.id, guildId });
      let targetCoins = await UserCoins.findOne({ userId: targetUser.id, guildId });

      if (!userCoins) {
        userCoins = await UserCoins.create({ userId: message.author.id, guildId });
      }

      if (!targetCoins) {
        targetCoins = await UserCoins.create({ userId: targetUser.id, guildId });
      }

      const robberyChance = Math.random();
      let stolenCoins = 0;

      if (robberyChance <= 0.5) {
        stolenCoins = Math.floor(targetCoins.coins * (Math.random() * 0.5));
        targetCoins.coins -= stolenCoins;
        await targetCoins.save();

        userCoins.coins += stolenCoins;
        await userCoins.save();
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
        .setDescription(stolenCoins > 0
          ? `💰・Vous avez volé **${stolenCoins}** coins à ${targetUser.tag}.`
          : `❌・Vous n'avez pas réussi à voler ${targetUser.tag}`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors de la tentative de vol.');
    }
  },
};
