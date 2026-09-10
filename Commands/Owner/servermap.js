const {
  ChannelType
} = require('discord.js');

const {
  requireBotOwner
} = require('../../utils/ownerPermissions.js');
const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

function getPosition(channel) {
  const rawPosition =
    Number(channel?.rawPosition);

  if (Number.isFinite(rawPosition)) {
    return rawPosition;
  }

  const position =
    Number(channel?.position);

  return Number.isFinite(position)
    ? position
    : 0;
}

function sortLikeDiscord(a, b) {
  const positionDiff =
    getPosition(a) -
    getPosition(b);

  if (positionDiff !== 0) {
    return positionDiff;
  }

  return String(a.id)
    .localeCompare(String(b.id));
}

function getChannelType(channel) {
  switch (channel.type) {
    case ChannelType.GuildText:
      return {
        icon: '#',
        label: 'TEXTE'
      };

    case ChannelType.GuildAnnouncement:
      return {
        icon: '📢',
        label: 'ANNONCES'
      };

    case ChannelType.GuildVoice:
      return {
        icon: '🔊',
        label: 'VOCAL'
      };

    case ChannelType.GuildStageVoice:
      return {
        icon: '🎙️',
        label: 'STAGE'
      };

    case ChannelType.GuildForum:
      return {
        icon: '💬',
        label: 'FORUM'
      };

    case ChannelType.GuildMedia:
      return {
        icon: '🖼️',
        label: 'MÉDIA'
      };

    default:
      return {
        icon: '•',
        label: `TYPE ${channel.type}`
      };
  }
}

function formatChannel(channel, indent = '') {
  const type =
    getChannelType(channel);

  return (
    `${indent}${type.icon} ${channel.name}` +
    `  [${type.label}]` +
    `  [ID: ${channel.id}]`
  );
}

function buildServerMap(guild) {
  const channels = [
    ...guild.channels.cache.values()
  ];

  const categories =
    channels.filter(channel =>
      channel.type ===
        ChannelType.GuildCategory
    );

  const categoryIds =
    new Set(
      categories.map(category =>
        category.id
      )
    );

  const topLevel =
    channels
      .filter(channel =>
        channel.type ===
          ChannelType.GuildCategory ||
        !channel.parentId ||
        !categoryIds.has(
          channel.parentId
        )
      )
      .sort(sortLikeDiscord);

  const childrenByCategory =
    new Map();

  for (const category of categories) {
    childrenByCategory.set(
      category.id,
      channels
        .filter(channel =>
          channel.parentId ===
            category.id
        )
        .sort(sortLikeDiscord)
    );
  }

  const lines = [
    'STRUCTURE DISCORD',
    '=================',
    `Serveur : ${guild.name}`,
    `ID : ${guild.id}`,
    `Catégories : ${categories.length}`,
    `Salons : ${channels.length - categories.length}`,
    `Généré : ${new Date().toISOString()}`,
    '',
    'ORDRE DU SERVEUR',
    '================',
    ''
  ];

  for (const channel of topLevel) {
    if (
      channel.type ===
      ChannelType.GuildCategory
    ) {
      lines.push(
        `📁 ${channel.name}  [CATÉGORIE]  [ID: ${channel.id}]`
      );

      const children =
        childrenByCategory.get(
          channel.id
        ) || [];

      if (!children.length) {
        lines.push(
          '   └─ (catégorie vide)'
        );
      } else {
        children.forEach(
          (child, index) => {
            const branch =
              index ===
              children.length - 1
                ? '└─'
                : '├─';

            lines.push(
              formatChannel(
                child,
                `   ${branch} `
              )
            );
          }
        );
      }

      lines.push('');
      continue;
    }

    lines.push(
      formatChannel(channel)
    );
  }

  return lines.join('\n');
}

module.exports = {
  name: 'servermap',
  aliases: [
    'discordmap',
    'serverlayout'
  ],
  description:
    'Exporte temporairement la structure complète du serveur dans un fichier texte.',
  hidden: true,

  async execute(message) {
    if (!message.guild) return;

    if (
      !(await requireBotOwner(message))
    ) {
      return;
    }

    await message.guild.channels
      .fetch()
      .catch(() => null);

    const serverMap =
      buildServerMap(
        message.guild
      );

    const attachment =
      Buffer.from(
        `\uFEFF${serverMap}`,
        'utf8'
      );

    return message.reply({
      ...replyEmbedPayload(
        'Voici la structure actuelle du serveur, triée dans le même ordre que la liste des salons Discord.\n\n-# Envoie-moi ensuite le fichier `.txt` pour que je puisse analyser l’organisation.',
        {
          type: 'success',
          title: '🗺️ Structure du serveur'
        }
      ),
      files: [
        {
          attachment,
          name:
            `discord-structure-${message.guild.id}.txt`
        }
      ]
    });
  }
};
