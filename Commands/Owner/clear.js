const Owner = require('../../Models/Owner.js');
const {
  sendStaffLog,
  buildDiscordLog
} = require('../../utils/staffLogs.js');

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const BULK_DELETE_MARGIN = 60 * 1000;

async function isBotOwner(userId) {
  if (userId === process.env.BUYER) return true;

  return Boolean(
    await Owner.exists({ userId })
  );
}

async function deleteBatch(channel, messages) {
  let deleted = 0;

  const now = Date.now();

  const recentMessages = messages.filter(
    msg =>
      now - msg.createdTimestamp <
      FOURTEEN_DAYS - BULK_DELETE_MARGIN
  );

  const oldMessages = messages.filter(
    msg => !recentMessages.has(msg.id)
  );

  if (recentMessages.size > 0) {
    const result = await channel.bulkDelete(
      recentMessages,
      true
    );

    deleted += result.size;
  }

  // bulkDelete ne peut pas supprimer les messages de plus de 14 jours.
  // Ceux-ci sont donc supprimés un par un.
  for (const oldMessage of oldMessages.values()) {
    try {
      await oldMessage.delete();
      deleted++;
    } catch (error) {
      console.error(
        `Impossible de supprimer le message ${oldMessage.id} :`,
        error?.code || error?.message || error
      );
    }
  }

  return deleted;
}

async function clearMessages(channel, requestedAmount = null) {
  let deleted = 0;
  let before;

  while (
    requestedAmount === null ||
    deleted < requestedAmount
  ) {
    const remaining =
      requestedAmount === null
        ? 100
        : Math.min(100, requestedAmount - deleted);

    if (remaining <= 0) break;

    const fetched = await channel.messages.fetch({
      limit: remaining,
      ...(before ? { before } : {})
    });

    if (!fetched.size) break;

    const oldest = fetched.last();
    before = oldest?.id;

    deleted += await deleteBatch(
      channel,
      fetched
    );

    if (fetched.size < remaining) break;

    // Évite de tourner en boucle si Discord ne renvoie plus de page suivante.
    if (!before) break;
  }

  return deleted;
}

module.exports = {
  name: 'clear',
  description: 'Supprime des messages du salon.',
  usage: 'clear [nombre]',

  async execute(message, args) {
    if (!message.guild) return;

    if (!(await isBotOwner(message.author.id))) {
      return;
    }

    const channel = message.channel;

    if (
      !channel?.isTextBased?.() ||
      !channel.messages
    ) {
      return;
    }

    let requestedAmount = null;

    if (args[0] !== undefined) {
      requestedAmount = Number(args[0]);

      if (
        !Number.isInteger(requestedAmount) ||
        requestedAmount <= 0
      ) {
        return message.reply(
          '❌・Utilisation : **+clear** ou **+clear <nombre>**'
        );
      }
    }

    // La commande elle-même n'est pas comptée dans le nombre demandé.
    await message.delete().catch(() => {});

    try {
      const deleted = await clearMessages(
        channel,
        requestedAmount
      );

      await sendStaffLog(
        message.guild,
        'moderation-logs',
        buildDiscordLog({
          title: '🧹 Clear',
          description:
            `${message.author} a supprimé **${deleted} message${deleted > 1 ? 's' : ''}** dans ${channel}.\n` +
            `-# Commande : +clear${requestedAmount !== null ? ` ${requestedAmount}` : ''}`,
          color: 0x5865f2
        })
      );

      const confirmation = await channel.send(
        `✅・**${deleted}** message${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}.`
      );

      setTimeout(() => {
        confirmation.delete().catch(() => {});
      }, 3000);
    } catch (error) {
      console.error('Erreur +clear :', error);

      const errorMessage = await channel.send(
        '❌・Une erreur est survenue pendant la suppression des messages.'
      ).catch(() => null);

      if (errorMessage) {
        setTimeout(() => {
          errorMessage.delete().catch(() => {});
        }, 5000);
      }
    }
  }
};
