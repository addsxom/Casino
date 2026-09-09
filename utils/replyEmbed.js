const {
  EmbedBuilder
} = require('discord.js');

const COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x6b6de6
};

const TITLES = {
  success: '✅ Succès',
  error: '❌ Erreur',
  warning: '⚠️ Attention',
  info: 'ℹ️ Information'
};

function buildReplyEmbed({
  type = 'info',
  title = null,
  description = '',
  fields = [],
  footer = null,
  thumbnail = null
} = {}) {
  const normalizedType =
    Object.prototype.hasOwnProperty.call(
      COLORS,
      type
    )
      ? type
      : 'info';

  const embed =
    new EmbedBuilder()
      .setColor(
        COLORS[normalizedType]
      )
      .setTitle(
        title ||
        TITLES[normalizedType]
      )
      .setDescription(
        String(description || '')
      )
      .setTimestamp();

  if (Array.isArray(fields) && fields.length) {
    embed.addFields(fields);
  }

  if (footer) {
    embed.setFooter(
      typeof footer === 'string'
        ? { text: footer }
        : footer
    );
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}

function replyEmbedPayload(
  description,
  options = {}
) {
  return {
    embeds: [
      buildReplyEmbed({
        description,
        ...options
      })
    ]
  };
}

module.exports = {
  COLORS,
  buildReplyEmbed,
  replyEmbedPayload
};
