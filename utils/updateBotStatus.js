const BOT_STATUS_CHANNEL = {
  id: '1546360551503044658',
  name: '╰・BOT STATUT'
};

const ONLINE_NAME = '╰・BOT STATUT /🟢';
const OFFLINE_NAME = '╰・BOT STATUT /🔴';

function normalizeStatusName(name) {
  return String(name || '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesStatusChannelName(channel) {
  const name = normalizeStatusName(channel?.name);
  const base = normalizeStatusName(BOT_STATUS_CHANNEL.name);

  return (
    name === base ||
    name === normalizeStatusName(ONLINE_NAME) ||
    name === normalizeStatusName(OFFLINE_NAME) ||
    name.startsWith(`${base} /`)
  );
}

async function findBotStatusChannel(guild) {
  if (!guild) return null;

  let channel =
    guild.channels.cache.get(BOT_STATUS_CHANNEL.id) ||
    await guild.channels.fetch(BOT_STATUS_CHANNEL.id).catch(() => null);

  if (channel) {
    if (!matchesStatusChannelName(channel)) {
      console.warn(
        `Salon BOT STATUT trouvé par ID mais avec un nom différent : ${channel.name}`
      );
    }

    return channel;
  }

  await guild.channels.fetch().catch(() => null);

  return guild.channels.cache.find(
    candidate => matchesStatusChannelName(candidate)
  ) || null;
}

async function updateBotStatusChannel(guild, isConnected) {
  try {
    const channel = await findBotStatusChannel(guild);

    if (!channel) {
      console.error(
        `Salon BOT STATUT introuvable (ID: ${BOT_STATUS_CHANNEL.id}, nom: ${BOT_STATUS_CHANNEL.name})`
      );
      return false;
    }

    const newName = isConnected
      ? ONLINE_NAME
      : OFFLINE_NAME;

    if (channel.name === newName) {
      return true;
    }

    await channel.setName(
      newName,
      isConnected
        ? 'Bot connecté au vocal BOT STATUT'
        : 'Bot déconnecté du vocal BOT STATUT'
    );

    return true;
  } catch (error) {
    console.error(
      'Erreur mise à jour BOT STATUT :',
      error?.code || error?.message || error
    );

    return false;
  }
}

module.exports = {
  BOT_STATUS_CHANNEL,
  ONLINE_NAME,
  OFFLINE_NAME,
  findBotStatusChannel,
  updateBotStatusChannel
};
