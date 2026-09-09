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

function pluralize(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const parts = [];

  if (days > 0) {
    parts.push(pluralize(days, 'jour', 'jours'));
  }

  if (hours > 0) {
    parts.push(pluralize(hours, 'heure', 'heures'));
  }

  if (minutes > 0) {
    parts.push(pluralize(minutes, 'minute', 'minutes'));
  }

  parts.push(pluralize(seconds, 'seconde', 'secondes'));

  if (parts.length === 1) {
    return parts[0];
  }

  return (
    parts.slice(0, -1).join(', ') +
    ' et ' +
    parts.at(-1)
  );
}
