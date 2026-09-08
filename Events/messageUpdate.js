const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;

  const before = oldMessage.content || '';
  const after = newMessage.content || '';

  if (!before || before === after) return;

  await sendStaffLog(
    newMessage.guild,
    'discord-logs',
    buildDiscordLog({
      title: '✏️ Message modifié',
      color: 0xfee75c,
      fields: [
        {
          name: 'Auteur',
          value: `${newMessage.author} • \`${newMessage.author.id}\``,
          inline: false
        },
        {
          name: 'Salon',
          value: `${newMessage.channel}`,
          inline: false
        },
        {
          name: 'Avant',
          value: before.slice(0, 1000) || '*Vide*',
          inline: false
        },
        {
          name: 'Après',
          value: after.slice(0, 1000) || '*Vide*',
          inline: false
        }
      ]
    })
  );
};
