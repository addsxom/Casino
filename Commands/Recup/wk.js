const { EmbedBuilder } = require("discord.js");
const UserCoins = require('../../Models/UserCoins.js');
const UserWorkCooldown = require('../../Models/UserWorkCooldown.js');

module.exports = {
  name: 'wk',
  description: 'Gagnez des coins en travaillant.',
  async execute(message) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    try {

      const userWorkCooldown = await UserWorkCooldown.findOne({ userId, guildId });

      if (userWorkCooldown && Date.now() < userWorkCooldown.cooldown) {
        const timeLeft = userWorkCooldown.cooldown - Date.now();
        const formattedTimeLeft = formatCooldown(timeLeft);

        const cooldownEmbed = new EmbedBuilder()
          .setTitle('Vous avez déjà work récemment')
          .setDescription(`❌・Réessayez dans ${formattedTimeLeft}`)
          .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
          .setColor(0xFF0000);

        return message.reply({ embeds: [cooldownEmbed] });
      }

      const coinsEarned = Math.floor(Math.random() * (1000 - 15 + 1)) + 15;

      let userCoins = await UserCoins.findOne({ userId, guildId });

      if (!userCoins) {
        userCoins = await UserCoins.create({ userId, guildId });
      }

      userCoins.coins += coinsEarned;
      await userCoins.save();

      if (userWorkCooldown) {
        userWorkCooldown.cooldown = Date.now() + 60 * 60 * 1000; 
        await userWorkCooldown.save();
      } else {
        await UserWorkCooldown.create({ userId, guildId, cooldown: Date.now() + 60 * 60 * 1000 }); 
      }

      const embed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true })})
        .setDescription(`💰・Vous avez gagné ${coinsEarned} coins`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors de la récupération des coins.');
    }
  },
};


function formatCooldown(time) {
  const seconds = Math.floor(time / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let formattedTime = '';

  if (days > 0) {
    formattedTime += `${days} jour, `;
  }

  if (hours % 24 > 0) {
    formattedTime += `${hours % 24} heures, `;
  }

  if (minutes % 60 > 0) {
    formattedTime += `${minutes % 60} minutes et `;
  }

  formattedTime += `${seconds % 60} secondes.`;

  return formattedTime.trim();
}
