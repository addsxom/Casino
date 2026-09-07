const Discord = require("discord.js");

module.exports = {
  name: "ping",
  description: 'Répond avec "Pong!"',

  async execute(message, args) {
    const botPing = Date.now() - message.createdTimestamp;
    const latency = Math.round(message.client.ws.ping);

    const pingEmbed = new Discord.EmbedBuilder()
      .addFields(
        { name: 'Ping', value: `${botPing}ms`, inline: true },
        { name: 'Latence', value: `${latency}ms`, inline: true },
      )
      .setColor(0x6b6de6);

    await message.channel.send({ embeds: [pingEmbed] });
  },
};
