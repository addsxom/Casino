const { EmbedBuilder } = require("discord.js");
const UserRepCooldown = require('../../Models/UserRepCooldown.js');
const { incrementAccountField } = require('../../utils/economyService.js');
const { tryAcquireCooldown, releaseCooldown } = require('../../utils/cooldownService.js');

const cooldowns = new Map();

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: 'rep',
  description: 'Donne un point de réputation à un utilisateur.',
  cooldown: 7200,
  async execute(message, args) {
    const guildId = message.guild.id;

    try {
      const targetUser = message.mentions.users.first() || message.client.users.cache.get(args[0]);

      if (!targetUser) {
        return message.reply(replyEmbedPayload('Veuillez mentionner un utilisateur ou fournir un ID valide.', { type: 'error' }));
      }

      if (targetUser.id === message.author.id) {
        return message.reply(replyEmbedPayload('Vous ne pouvez pas vous donner de point de réputation.', { type: 'error' }));
      }
      const cooldown = await tryAcquireCooldown(
        UserRepCooldown,
        {
          userId: message.author.id,
          guildId,
          durationMs: this.cooldown * 1000
        }
      );

      if (!cooldown.acquired) {
        const timeLeft = Math.max(
          0,
          cooldown.availableAt - Date.now()
        );
        const formattedTimeLeft = formatCooldown(timeLeft);

        const colldown = new EmbedBuilder()
          .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
          .setDescription(`❌・Réessayez dans ${formattedTimeLeft}`)
          .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
          .setColor(0x6b6de6);

        return message.reply({ embeds: [colldown] });
      }

      try {
        await incrementAccountField({
          userId: targetUser.id,
          guildId,
          field: 'rep',
          amount: 1
        });
      } catch (error) {
        await releaseCooldown(
          UserRepCooldown,
          {
            userId: message.author.id,
            guildId,
            availableAt: cooldown.availableAt
          }
        );

        throw error;
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
        .setDescription(`🔺・Vous avez donné 1 réputation à ${targetUser.tag}.`)
        .setFooter({ text: 'Kuromi Coins', iconURL: message.client.user.displayAvatarURL({ dynamic: true })})
        .setColor(0x6b6de6);

      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply(replyEmbedPayload('Une erreur s\'est produite lors de l\'ajout du point de réputation.', { type: 'error' }));
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
