const discordTranscripts =
  require('discord.js-html-transcript');

const {
  replyEmbedPayload
} = require('./replyEmbed.js');

const {
  getTicketOwnerId,
  getTicketTypeKey
} = require('./ticketSystem.js');

function sanitizeFilename(value) {
  return String(value || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'ticket';
}

async function createTicketTranscript(channel) {
  const filename =
    `transcript-${sanitizeFilename(channel.name)}-${channel.id}.html`;

  return discordTranscripts.createTranscript(
    channel,
    {
      returnType: 'attachment',
      filename,
      limit: -1,
      footerText:
        'Transcript de {number} message{s} • Kuromi Support',
      poweredBy: true,
      features: {
        search: true,
        imagePreview: true,
        spoilerReveal: true,
        messageLinks: true,
        profileBadges: true,
        embedTweaks: true
      }
    }
  );
}

async function deliverTicketTranscript({
  channel,
  closedBy
}) {
  const ownerId =
    getTicketOwnerId(channel);

  if (!ownerId) {
    throw new Error(
      'INVALID_TICKET_CHANNEL'
    );
  }

  const typeKey =
    getTicketTypeKey(channel);

  const transcript =
    await createTicketTranscript(
      channel
    );

  const owner =
    await channel.client.users
      .fetch(ownerId)
      .catch(() => null);

  const closedAtUnix =
    Math.floor(Date.now() / 1000);

  let dmSent = false;

  if (owner) {
    dmSent = await owner.send({
      ...replyEmbedPayload(
        `Ton ticket **#${channel.name}** sur **${channel.guild.name}** a été fermé.\n\n` +
        `👮 **Fermé par :** ${closedBy}\n` +
        `📂 **Type :** ${typeKey || 'inconnu'}\n` +
        `🕒 **Fermé le :** <t:${closedAtUnix}:F>\n\n` +
        'Le transcript HTML complet de la conversation est joint à ce message.',
        {
          type: 'info',
          title: '📄 Transcript de ton ticket'
        }
      ),
      files: [transcript]
    })
      .then(() => true)
      .catch(() => false);
  }

  if (
    !dmSent &&
    closedBy?.send
  ) {
    await closedBy.send({
      ...replyEmbedPayload(
        `Le transcript du ticket **#${channel.name}** n’a pas pu être envoyé à <@${ownerId}> (DM probablement fermés).\n\n` +
        'Je te l’envoie en sauvegarde avant la suppression du ticket.',
        {
          type: 'warning',
          title: '📄 Transcript non livré'
        }
      ),
      files: [transcript]
    }).catch(() => {});
  }

  return {
    ownerId,
    typeKey,
    dmSent
  };
}

async function deleteTicketChannel(
  channel,
  closedBy
) {
  await channel.delete(
    `Ticket fermé par ${closedBy?.tag || closedBy?.username || closedBy?.id || 'staff'}`
  );
}

module.exports = {
  createTicketTranscript,
  deliverTicketTranscript,
  deleteTicketChannel
};
