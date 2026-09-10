const discordTranscripts =
  require('discord.js-html-transcript');

const {
  replyEmbedPayload
} = require('./replyEmbed.js');

const {
  getTicketOwnerId,
  getTicketTypeKey
} = require('./ticketSystem.js');

const {
  getConfiguredChannelId
} = require('./configService.js');

const closingTickets = new Set();

function tryLockTicketClosure(channelId) {
  const id = String(channelId || '');

  if (!id || closingTickets.has(id)) {
    return false;
  }

  closingTickets.add(id);
  return true;
}

function releaseTicketClosure(channelId) {
  closingTickets.delete(
    String(channelId || '')
  );
}

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

async function archiveTicketTranscript({
  channel,
  closedBy,
  transcript,
  ownerId,
  typeKey,
  closedAtUnix
}) {
  const archiveChannelId =
    getConfiguredChannelId(
      'ticketlogs',
      channel.guild.id
    );

  if (!archiveChannelId) {
    return false;
  }

  const archiveChannel =
    channel.guild.channels.cache.get(
      archiveChannelId
    ) ||
    await channel.guild.channels
      .fetch(archiveChannelId)
      .catch(() => null);

  if (
    !archiveChannel?.isTextBased?.()
  ) {
    return false;
  }

  await archiveChannel.send({
    ...replyEmbedPayload(
      `**Ticket :** #${channel.name}\n` +
      `👤 **Créateur :** <@${ownerId}>\n` +
      `👮 **Fermé par :** ${closedBy}\n` +
      `📂 **Type :** ${typeKey || 'inconnu'}\n` +
      `🕒 **Fermé le :** <t:${closedAtUnix}:F>\n` +
      `-# Salon : ${channel.id}`,
      {
        type: 'info',
        title: '📄 Transcript de ticket archivé'
      }
    ),
    files: [transcript]
  });

  return true;
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

  const closedAtUnix =
    Math.floor(Date.now() / 1000);

  const archived =
    await archiveTicketTranscript({
      channel,
      closedBy,
      transcript,
      ownerId,
      typeKey,
      closedAtUnix
    });

  if (!archived) {
    throw new Error(
      'TICKET_ARCHIVE_FAILED'
    );
  }

  const owner =
    await channel.client.users
      .fetch(ownerId)
      .catch(() => null);

  let dmSent = false;

  if (owner) {
    dmSent = await owner.send(
      replyEmbedPayload(
        `Ton ticket **#${channel.name}** sur **${channel.guild.name}** a été fermé.\n\n` +
        `👮 **Fermé par :** ${closedBy}\n` +
        `📂 **Type :** ${typeKey || 'inconnu'}\n` +
        `🕒 **Fermé le :** <t:${closedAtUnix}:F>\n\n` +
        'Le transcript HTML complet de la conversation arrive juste en dessous.',
        {
          type: 'info',
          title: '📄 Transcript de ton ticket'
        }
      )
    )
      .then(async () => {
        await owner.send({
          files: [transcript]
        });

        return true;
      })
      .catch(() => false);
  }

  if (
    !dmSent &&
    closedBy?.send
  ) {
    await closedBy.send(
      replyEmbedPayload(
        `Le transcript du ticket **#${channel.name}** n’a pas pu être envoyé à <@${ownerId}> (DM probablement fermés).\n\n` +
        'Je te l’envoie en sauvegarde juste en dessous avant la suppression du ticket.',
        {
          type: 'warning',
          title: '📄 Transcript non livré'
        }
      )
    ).catch(() => {});

    await closedBy.send({
      files: [transcript]
    }).catch(() => {});
  }

  return {
    ownerId,
    typeKey,
    dmSent,
    archived
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
  tryLockTicketClosure,
  releaseTicketClosure,
  createTicketTranscript,
  archiveTicketTranscript,
  deliverTicketTranscript,
  deleteTicketChannel
};
