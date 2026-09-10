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

module.exports = {
  name: 'unlock',
  description:
    'Déverrouille un salon et réautorise les membres à écrire.',
  usage: 'unlock [#salon/ID]',

  async execute(message, args) {
    if (!message.guild) return;

    if (!isStaff(message.member)) {
      return message.reply(
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
      return message.reply(
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
      return message.reply(
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

      return message.reply(
        replyEmbedPayload(
          `${channel} est maintenant déverrouillé.\n\nLes membres peuvent de nouveau écrire.`,
          {
            type: 'success',
            title: '🔓 Salon déverrouillé'
          }
        )
      );
    } catch (error) {
      console.error(
        'Erreur +unlock :',
        error
      );

      return message.reply(
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
