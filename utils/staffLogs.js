const { EmbedBuilder } = require('discord.js');
const { formatAmount, formatFullAmount } = require('./formatAmount.js');

function findStaffLogChannel(guild, key) {
  if (!guild) return null;

  const needle = String(key).toLowerCase();

  return guild.channels.cache.find(channel => {
    if (!channel?.isTextBased?.()) return false;

    const name = String(channel.name || '').toLowerCase();
    return name.includes(needle);
  }) || null;
}

async function sendStaffLog(guild, key, embed) {
  try {
    const channel = findStaffLogChannel(guild, key);
    if (!channel) return false;

    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error(`Erreur log staff (${key}) :`, error);
    return false;
  }
}

function buildEconomyLog({
  title,
  user,
  amount,
  pocket,
  bank,
  sourceChannel,
  color = 0x6b6de6
}) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .addFields(
      {
        name: '👤 Membre',
        value: `${user} • \`${user.id}\``,
        inline: false
      },
      {
        name: '💰 Montant',
        value: `**${formatAmount(amount)}** • \`${formatFullAmount(amount)}\``,
        inline: true
      },
      {
        name: '🪙 Poche après',
        value: `${formatAmount(pocket)} • \`${formatFullAmount(pocket)}\``,
        inline: true
      },
      {
        name: '🏦 Banque après',
        value: `${formatAmount(bank)} • \`${formatFullAmount(bank)}\``,
        inline: true
      },
      {
        name: '📍 Salon',
        value: sourceChannel ? `${sourceChannel}` : 'Inconnu',
        inline: false
      }
    )
    .setTimestamp();
}

function buildDiscordLog({
  title,
  description,
  color = 0x6b6de6,
  fields = []
}) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  if (fields.length) {
    embed.addFields(fields);
  }

  return embed;
}

module.exports = {
  findStaffLogChannel,
  sendStaffLog,
  buildEconomyLog,
  buildDiscordLog
};
