const { sendStaffLog, buildDiscordLog } = require('../utils/staffLogs.js');

module.exports = async (_bot, oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;

  const before = oldMessage.content || '';
  const after = newMessage.content || '';

  if (!before || before === after) return;

  await sendStaffLog(
    newMessage.guild,
    'message-logs',
    buildDiscordLog({
      title: '✏️ Message modifié',
      description: `${newMessage.author} dans ${newMessage.channel}`,
      color: 0xfee75c,
      fields: [
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
