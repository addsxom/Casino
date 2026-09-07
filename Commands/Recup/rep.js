const { EmbedBuilder } = require("discord.js");
const UserRepCooldown = require('../../Models/UserRepCooldown.js');
const UserCoins = require('../../Models/UserCoins.js');

const cooldowns = new Map();

module.exports = {
  name: 'rep',
  description: 'Donne un point de réputation à un utilisateur.',
  cooldown: 7200,
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const targetUser = message.mentions.users.first() || message.client.users.cache.get(args[0]);

      if (!targetUser) {
        return message.reply('Veuillez mentionner un utilisateur ou fournir un ID valide.');
      }

      if (targetUser.id === message.author.id) {
        return message.reply('Vous ne pouvez pas vous donner de point de réputation.');
      }
      const userCooldown = await UserRepCooldown.findOne({ userId: message.author.id, guildId });

      if (userCooldown && Date.now() < userCooldown.cooldown) {
        const timeLeft = userCooldown.cooldown - Date.now();
        const formattedTimeLeft = formatCooldown(timeLeft);

        const colldown = new EmbedBuilder()
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
        .setDescription(`❌・Réessayez dans ${formattedTimeLeft}`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

     return message.reply({ embeds: [colldown] });
    }

      let userCoins = await UserCoins.findOne({ userId: targetUser.id, guildId });

      if (!userCoins) {
        userCoins = await UserCoins.create({ userId: targetUser.id, guildId });
      }

      userCoins.rep += 1;
      await userCoins.save();

      if (userCooldown) {
        userCooldown.cooldown = Date.now() + this.cooldown * 1000;
        await userCooldown.save();
      } else {
        await UserRepCooldown.create({ userId: message.author.id, guildId, cooldown: Date.now() + this.cooldown * 1000 });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
        .setDescription(`🔺・Vous avez donné 1 réputation à ${targetUser.tag}.`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply('Une erreur s\'est produite lors de l\'ajout du point de réputation.');
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
