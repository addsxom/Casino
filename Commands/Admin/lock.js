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

  setTimeout(async () => {
    await Promise.allSettled([
      response.delete(),
      message.delete()
    ]);
  }, 2000);

  return response;
}

module.exports = {
  name: 'lock',
  description:
    'Verrouille ou déverrouille un salon pour gérer temporairement l’écriture des membres.',
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

      await message.delete().catch(() => {});

      return channel.send(
        replyEmbedPayload(
          'Les membres ne peuvent plus envoyer de messages pour le moment. Seul le staff peut écrire jusqu’à la réouverture.',
          {
            type: 'warning',
            title: '🔒 Salon temporairement désactivé'
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
