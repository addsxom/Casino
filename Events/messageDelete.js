const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, message) => {
  if (!message.guild || message.author?.bot) return;

  const content = message.content
    ? message.content.slice(0, 1000)
    : '*Contenu indisponible*';

  await sendStaffLog(
    message.guild,
    'discord-logs',
    buildDiscordLog({
      title: '🗑️ Message supprimé',
      description: content,
      color: 0xed4245,
      fields: [
        {
          name: 'Auteur',
          value: message.author
            ? `${message.author} • \`${message.author.id}\``
            : 'Inconnu',
          inline: false
        },
        {
          name: 'Salon',
          value: `${message.channel}`,
          inline: true
        },
        {
          name: 'Message ID',
          value: `\`${message.id}\``,
          inline: true
        }
      ]
    })
  );
};
