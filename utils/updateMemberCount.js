const config = require('../config/botConfig.js');
// Discord limite les renommages répétés d'un même salon.
// On espace les renommages et on garde une seule mise à jour en attente.
const RENAME_INTERVAL_MS = config.system.memberCountRenameIntervalMs;

const lastRenameAt = new Map();
const pendingTimers = new Map();

async function performMemberCountUpdate(guild) {
  if (!guild) return false;

  try {
    const channel =
      guild.channels.cache.get(config.channels.memberCount) ||
      await guild.channels.fetch(config.channels.memberCount);

    if (!channel) {
      console.error('Salon compteur de membres introuvable.');
      return false;
    }

    const memberCount = guild.memberCount;
    const newName = `👥・Membres : ${memberCount}`;

    if (channel.name === newName) {
      return true;
    }

    await channel.setName(
      newName,
      'Mise à jour automatique du nombre de membres'
    );

    lastRenameAt.set(guild.id, Date.now());
    return true;
  } catch (error) {
    console.error(
      'Erreur compteur de membres :',
      error?.code || error?.message || error
    );
    return false;
  }
}

function scheduleLatestUpdate(guild, delay) {
  if (pendingTimers.has(guild.id)) {
    return;
  }

  const timer = setTimeout(async () => {
    pendingTimers.delete(guild.id);

    const success = await performMemberCountUpdate(guild);

    // Si Discord refuse encore le renommage, on retente plus tard.
    if (!success) {
      scheduleLatestUpdate(guild, RENAME_INTERVAL_MS);
    }
  }, Math.max(1000, delay));

  pendingTimers.set(guild.id, timer);
}

async function updateMemberCount(guild) {
  if (!guild) return;

  const lastUpdate = lastRenameAt.get(guild.id) || 0;
  const elapsed = Date.now() - lastUpdate;

  // Première mise à jour ou intervalle suffisant : tentative immédiate.
  if (!lastUpdate || elapsed >= RENAME_INTERVAL_MS) {
    const success = await performMemberCountUpdate(guild);

    if (!success) {
      scheduleLatestUpdate(guild, RENAME_INTERVAL_MS);
    }

    return;
  }

  // Plusieurs arrivées/départs rapprochés :
  // une seule mise à jour est programmée avec le nombre le plus récent.
  scheduleLatestUpdate(
    guild,
    RENAME_INTERVAL_MS - elapsed
  );
}

module.exports = {
  updateMemberCount,
  getMemberCountChannelId: () => config.channels.memberCount
};
