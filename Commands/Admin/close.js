const {
  isStaff,
  isTicketChannel
} = require('../../utils/ticketSystem.js');

const {
  tryLockTicketClosure,
  releaseTicketClosure,
  deliverTicketTranscript,
  deleteTicketChannel
} = require('../../utils/ticketTranscript.js');

const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

module.exports = {
  name: 'close',
  description:
    'Ferme le ticket actuel et envoie son transcript au créateur.',

  async execute(message) {
    if (!message.guild) return;

    const ticketChannel = ticketChannel;
    const ticketChannelId = ticketChannel?.id;

    if (!ticketChannel || !ticketChannelId) {
      return;
    }

    if (
      !isTicketChannel(
        ticketChannel
      )
    ) {
      return message.reply(
        replyEmbedPayload(
          'Cette commande fonctionne uniquement dans un ticket.',
          {
            type: 'error',
            title: '🎫 Ticket requis'
          }
        )
      );
    }

    if (!isStaff(message.member)) {
      return message.reply(
        replyEmbedPayload(
          'Seuls les modérateurs peuvent fermer un ticket.',
          {
            type: 'error',
            title: '🛡️ Permission requise'
          }
        )
      );
    }

    if (
      !tryLockTicketClosure(
        ticketChannel.id
      )
    ) {
      return message.reply(
        replyEmbedPayload(
          'La fermeture de ce ticket est déjà en cours.',
          {
            type: 'warning',
            title: '🔒 Fermeture en cours'
          }
        )
      );
    }

    const statusMessage =
      await message.reply(
        replyEmbedPayload(
          'Je génère le transcript HTML complet du ticket avant sa fermeture.',
          {
            type: 'info',
            title: '📄 Création du transcript'
          }
        )
      );

    try {
      const result =
        await deliverTicketTranscript({
          channel: ticketChannel,
          closedBy: message.author
        });

      await statusMessage.edit(
        replyEmbedPayload(
          result.dmSent
            ? 'Le transcript a été envoyé en DM au créateur du ticket.\n\nSuppression du salon dans **2 secondes**.'
            : 'Les DM du créateur du ticket sont fermés ou indisponibles. Une copie du transcript a été envoyée au modérateur qui ferme le ticket.\n\nSuppression du salon dans **2 secondes**.',
          {
            type:
              result.dmSent
                ? 'success'
                : 'warning',
            title:
              result.dmSent
                ? '✅ Transcript envoyé'
                : '⚠️ DM indisponibles'
          }
        )
      );

      await sleep(2000);

      await deleteTicketChannel(
        ticketChannel,
        message.author
      );
    } catch (error) {
      console.error(
        'Erreur +close :',
        error
      );

      releaseTicketClosure(
        ticketChannelId
      );

      return statusMessage.edit(
        replyEmbedPayload(
          'Impossible de générer ou d’envoyer le transcript. Le ticket n’a pas été supprimé.',
          {
            type: 'error',
            title: '❌ Fermeture annulée'
          }
        )
      ).catch(() => {});
    }

    releaseTicketClosure(
      ticketChannelId
    );
  }
};
