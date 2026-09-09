const Discord = require("discord.js");

module.exports = {
  name: "uptime",
  description: "Affiche le temps de disponibilité du bot.",

  async execute(message, args) {
    try {
      const onlineSinceUnix = Math.floor(
        message.client.readyAt.getTime() / 1000
      );

      const uptimeEmbed = new Discord.EmbedBuilder()
        .setTitle('🕒 Uptime du bot')
        .setDescription(
          `**En ligne depuis**\n<t:${onlineSinceUnix}:F>`
        )
        .setColor(0x6b6de6)
        .setTimestamp(message.client.readyAt);

      await message.channel.send({ embeds: [uptimeEmbed] });
    } catch (err) {
      console.error(err);
    }
  },
};

