const Discord = require("discord.js");

module.exports = {
  name: "uptime",
  description: "Affiche le temps de disponibilité du bot.",

  async execute(message, args) {
    try {
      const uptimeInSeconds = Math.floor(
        (Date.now() - message.client.readyAt) / 1000
      );
      const uptimeText = formatUptime(uptimeInSeconds);

      const uptimeEmbed = new Discord.EmbedBuilder()
        .setDescription(
          `<:time:1145535458382716938> Je suis en ligne depuis **\`${uptimeText}\`**`
        )
        .setColor(0x6b6de6);

      await message.channel.send({ embeds: [uptimeEmbed] });
    } catch (err) {
      console.error(err);
    }
  },
};

function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  return `${days > 0 ? days + " jours, " : ""}${
    hours > 0 ? hours + " heures, " : ""
  }${minutes > 0 ? minutes + " minutes et " : ""}${seconds} seconds`;
}
