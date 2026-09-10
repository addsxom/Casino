const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

const {
  isStaff,
  isLockableChannel,
  resolveTargetChannel,
  lockChannel,
  sendChannelLockLog
} = require('../../utils/channelLock.js');

async function temporaryReply(message, payload) {
  const response = await message.reply(payload);

  setTimeout(() => {
    response.delete().catch(() => {});
    message.delete().catch(() => {});
  }, 2000);

  return response;
}

module.exports = {
  name: 'lock',
  description:
    'Verrouille un salon pour empêcher les membres d’écrire, sauf le staff.',
  usage: 'lock [#salon/ID]',

  async execute(message, args) {
    if (!message.guild) return;

    if (!isStaff(message.member)) {
      return temporaryReply(
        message,
        replyEmbedPayload(
          'Seuls les membres du staff peuvent verrouiller un salon.',
          {
            type: 'error',
            title: '🛡️ Permission requise'
          }
        )
      );
    }

    const channel =
      await resolveTargetChannel(
        message,
        args
      );

    if (!channel) {
      return temporaryReply(
        message,
        replyEmbedPayload(
          'Salon introuvable. Utilise `+lock` dans le salon concerné ou `+lock #salon`.',
          {
            type: 'error',
            title: '🔒 Salon introuvable'
          }
        )
      );
    }

    if (!isLockableChannel(channel)) {
      return temporaryReply(
        message,
        replyEmbedPayload(
          'Cette commande fonctionne uniquement sur un salon textuel classique ou d’annonces.',
          {
            type: 'error',
            title: '🔒 Salon incompatible'
          }
        )
      );
    }

    try {
      await lockChannel(
        channel,
        message.author
      );

      await sendChannelLockLog({
        guild: message.guild,
        channel,
        actor: message.author,
        locked: true
      });

      return temporaryReply(
        message,
        replyEmbedPayload(
          `${channel} est maintenant verrouillé.\n\nLes membres ne peuvent plus écrire, mais le staff conserve l’accès à l’écriture.`,
          {
            type: 'success',
            title: '🔒 Salon verrouillé'
          }
        )
      );
    } catch (error) {
      console.error(
        'Erreur +lock :',
        error
      );

      return temporaryReply(
        message,
        replyEmbedPayload(
          'Impossible de verrouiller ce salon. Vérifie que le bot possède les permissions nécessaires pour modifier les permissions du salon.',
          {
            type: 'error',
            title: '❌ Verrouillage impossible'
          }
        )
      );
    }
  }
};
