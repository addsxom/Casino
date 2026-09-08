const { EmbedBuilder } = require('discord.js');

const activeGames = new Map();
let lockSequence = 0;

function getKey(userId, guildId) {
  return `${guildId}:${userId}`;
}

function tryAcquireActiveGame({
  userId,
  guildId,
  game,
  channelId
}) {
  const key = getKey(userId, guildId);
  const existing = activeGames.get(key);

  if (existing) {
    return {
      acquired: false,
      activeGame: { ...existing }
    };
  }

  const token =
    `${Date.now()}-${++lockSequence}-${userId}`;

  const lock = {
    token,
    game,
    channelId,
    messageId: null,
    startedAt: Date.now()
  };

  activeGames.set(key, lock);

  return {
    acquired: true,
    token,
    activeGame: { ...lock }
  };
}

function updateActiveGame({
  userId,
  guildId,
  token,
  channelId,
  messageId
}) {
  const key = getKey(userId, guildId);
  const current = activeGames.get(key);

  if (!current || current.token !== token) {
    return false;
  }

  if (channelId) {
    current.channelId = channelId;
  }

  if (messageId) {
    current.messageId = messageId;
  }

  return true;
}

function releaseActiveGame({
  userId,
  guildId,
  token
}) {
  const key = getKey(userId, guildId);
  const current = activeGames.get(key);

  if (!current || current.token !== token) {
    return false;
  }

  activeGames.delete(key);
  return true;
}

function buildActiveGameEmbed(message, activeGame) {
  const channelId =
    activeGame?.channelId || message.channel.id;
  const messageId = activeGame?.messageId;

  let location =
    `📍 Salon : <#${channelId}>`;

  if (messageId) {
    const jumpUrl =
      `https://discord.com/channels/${message.guild.id}/${channelId}/${messageId}`;

    location +=
      `\n🔗 [Voir la partie en cours](${jumpUrl})`;
  }

  return new EmbedBuilder()
    .setTitle('🎮 Partie déjà en cours')
    .setDescription(
      `Tu as déjà une partie de **${activeGame?.game || 'jeu'}** active.\n\n` +
      location +
      '\n\nTermine cette partie avant d’en lancer une autre.'
    )
    .setColor(0x6b6de6)
    .setFooter({
      text: 'Kuromi Coins',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    });
}

module.exports = {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
};
