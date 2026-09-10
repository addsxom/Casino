const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

const {
  isStaff,
  isLockableChannel,
  resolveTargetChannel,
  unlockChannel,
  sendChannelLockLog
} = require('../../utils/channelLock.js');

async function temporaryReply(
  message,
  payload,
  afterDelete = null
) {
  const response = await message.reply(payload);

  setTimeout(async () => {
    await Promise.allSettled([
      response.delete(),
      message.delete()
    ]);

    if (typeof afterDelete === 'function') {
      try {
        await afterDelete();
      } catch (error) {
        console.error(
          'Erreur message d’état +unlock :',
          error
        );
      }
    }
  }, 2000);

  return response;
}

module.exports = {
  name: 'unlock',
  hidden: true,
  description:
    'Déverrouille un salon et réautorise les membres à écrire.',
  usage: 'unlock [#salon/ID]',

  async execute(message, args) {
    if (!message.guild) return;

    if (!isStaff(message.member)) {
      return temporaryReply(
        message,
        replyEmbedPayload(
          'Seuls les membres du staff peuvent déverrouiller un salon.',
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
          'Salon introuvable. Utilise `+unlock` dans le salon concerné ou `+unlock #salon`.',
          {
            type: 'error',
            title: '🔓 Salon introuvable'
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
            title: '🔓 Salon incompatible'
          }
        )
      );
    }

    try {
      await unlockChannel(
        channel,
        message.author
      );

      await sendChannelLockLog({
        guild: message.guild,
        channel,
        actor: message.author,
        locked: false
      });

      return temporaryReply(
        message,
        replyEmbedPayload(
          `${channel} est maintenant déverrouillé.\n\nLes membres peuvent de nouveau écrire.`,
          {
            type: 'success',
            title: '🔓 Salon déverrouillé'
          }
        ),
        async () => {
          await channel.send(
            '🔓 **Salon réactivé**\n' +
            'Le salon est de nouveau ouvert. Les membres peuvent à nouveau envoyer des messages.'
          );
        }
      );
    } catch (error) {
      console.error(
        'Erreur +unlock :',
        error
      );

      return temporaryReply(
        message,
        replyEmbedPayload(
          'Impossible de déverrouiller ce salon. Vérifie que le bot possède les permissions nécessaires pour modifier les permissions du salon.',
          {
            type: 'error',
            title: '❌ Déverrouillage impossible'
          }
        )
      );
    }
  }
};
