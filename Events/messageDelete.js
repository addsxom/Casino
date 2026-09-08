const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, message) => {
  if (!message.guild || message.author?.bot) return;

  const content = message.content
    ? message.content.slice(0, 1200)
    : '*Contenu indisponible*';

  await sendStaffLog(
    message.guild,
    'discord-logs',
    buildDiscordLog({
      title: '🗑️ Message supprimé',
      description:
        `${message.author || '**Auteur inconnu**'} dans ${message.channel}\n\n` +
        `> ${content.replace(/\n/g, '\n> ')}`,
      color: 0xed4245
    })
  );
};
