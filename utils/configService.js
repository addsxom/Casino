const config = require('../config/botConfig.js');
const BotConfigOverride =
  require('../Models/BotConfigOverride.js');

const overrideCache = new Map();

const CHANNEL_CONFIGS = {
  botvoice: {
    label: 'Vocal du bot',
    path: ['channels', 'botVoice', 'id'],
    type: 'voice',
    scope: 'guild',
    aliases: ['bot-voice', 'voicebot']
  },
  welcome: {
    label: 'Salon de bienvenue',
    path: ['channels', 'welcome'],
    type: 'text',
    scope: 'guild',
    aliases: ['bienvenue']
  },
  membercount: {
    label: 'Compteur de membres',
    path: ['channels', 'memberCount'],
    type: 'any',
    scope: 'guild',
    aliases: ['members', 'membres']
  },
  rewards: {
    label: 'Salon des récompenses',
    path: ['channels', 'rewards'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'reward',
      'reward-voc',
      'rewards-channel'
    ]
  },
  afkfarm: {
    label: 'Vocal AFK Farm',
    path: ['channels', 'afkFarm'],
    type: 'voice',
    scope: 'guild',
    aliases: [
      'afk',
      'farm',
      'afk-farm'
    ]
  },
  voicefarm: {
    label: 'Vocaux Farm',
    path: ['channels', 'voiceFarm'],
    type: 'voice',
    scope: 'guild',
    multiple: true,
    aliases: [
      'voice-farm',
      'voicefarms',
      'vocfarm',
      'voc-farm',
      'farmvoice'
    ]
  },
  botguildevents: {
    label: 'Arrivée/départ du bot',
    path: ['channels', 'botGuildEvents'],
    type: 'text',
    scope: 'global',
    aliases: [
      'guildevents',
      'bot-events'
    ]
  },
  slots: {
    label: 'Slots',
    path: ['channels', 'games', 'slots'],
    type: 'text',
    scope: 'guild',
    aliases: ['slot']
  },
  mines: {
    label: 'Mines',
    path: ['channels', 'games', 'mines'],
    type: 'text',
    scope: 'guild'
  },
  warn: {
    label: 'Logs warn',
    path: ['channels', 'staffLogs', 'warn', 'id'],
    type: 'text',
    scope: 'guild'
  },
  economylogs: {
    label: 'Logs économie',
    path: ['channels', 'staffLogs', 'economy', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'economy',
      'economy-logs'
    ]
  },
  banklogs: {
    label: 'Logs banque',
    path: ['channels', 'staffLogs', 'bank', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'bank',
      'bank-logs'
    ]
  },
  transactionlogs: {
    label: 'Logs transactions',
    path: ['channels', 'staffLogs', 'transaction', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'transaction',
      'transaction-logs'
    ]
  },
  messagelogs: {
    label: 'Logs messages',
    path: ['channels', 'staffLogs', 'message', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'message',
      'message-logs'
    ]
  },
  serverlogs: {
    label: 'Logs serveur',
    path: ['channels', 'staffLogs', 'server', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'server',
      'server-logs'
    ]
  },
  voicelogs: {
    label: 'Logs vocal',
    path: ['channels', 'staffLogs', 'voice', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'voice',
      'voice-logs'
    ]
  },
  moderationlogs: {
    label: 'Logs modération',
    path: ['channels', 'staffLogs', 'moderation', 'id'],
    type: 'text',
    scope: 'guild',
    aliases: [
      'moderation',
      'moderation-logs'
    ]
  }
};

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function resolveConfigKey(input) {
  const normalized = normalizeKey(input);

  for (
    const [key, entry]
    of Object.entries(CHANNEL_CONFIGS)
  ) {
    if (
      normalizeKey(key) === normalized
    ) {
      return key;
    }

    if (
      (entry.aliases || []).some(
        alias =>
          normalizeKey(alias) ===
          normalized
      )
    ) {
      return key;
    }
  }

  return null;
}

function getPathValue(path) {
  let current = config;

  for (const part of path) {
    current = current?.[part];
  }

  return current;
}

function getStorageKey(key, guildId) {
  const entry = CHANNEL_CONFIGS[key];

  if (!entry) return null;

  const scope =
    entry.scope === 'global'
      ? 'global'
      : String(
          guildId ||
          config.guildId
        );

  return `${scope}:${key}`;
}

function normalizeChannelIds(value) {
  let values = [];

  if (Array.isArray(value)) {
    values = value;
  } else if (
    typeof value === 'string'
  ) {
    const trimmed = value.trim();

    if (
      trimmed.startsWith('[') &&
      trimmed.endsWith(']')
    ) {
      try {
        const parsed =
          JSON.parse(trimmed);

        if (Array.isArray(parsed)) {
          values = parsed;
        }
      } catch {
        values = [];
      }
    }

    if (!values.length) {
      values =
        trimmed.match(
          /\d{17,20}/g
        ) || [];
    }
  }

  return [
    ...new Set(
      values
        .map(value =>
          String(value || '').trim()
        )
        .filter(value =>
          /^\d{17,20}$/.test(value)
        )
    )
  ];
}

function getConfiguredChannelIds(
  keyInput,
  guildId
) {
  const key =
    resolveConfigKey(keyInput);

  if (!key) return [];

  const entry =
    CHANNEL_CONFIGS[key];

  const storageKey =
    getStorageKey(
      key,
      guildId
    );

  const stored =
    overrideCache.get(storageKey);

  if (entry.multiple === true) {
    if (stored !== undefined) {
      return normalizeChannelIds(
        stored
      );
    }

    return normalizeChannelIds(
      getPathValue(entry.path)
    );
  }

  const value =
    stored ||
    getPathValue(entry.path);

  const id =
    String(value || '').trim();

  return /^\d{17,20}$/.test(id)
    ? [id]
    : [];
}

function getConfiguredChannelId(
  keyInput,
  guildId
) {
  const key =
    resolveConfigKey(keyInput);

  if (!key) return null;

  const entry =
    CHANNEL_CONFIGS[key];

  if (entry.multiple === true) {
    return (
      getConfiguredChannelIds(
        key,
        guildId
      )[0] || null
    );
  }

  return (
    getConfiguredChannelIds(
      key,
      guildId
    )[0] || null
  );
}

function getChannelConfigList(guildId) {
  return Object.entries(
    CHANNEL_CONFIGS
  ).map(([key, entry]) => {
    const ids =
      getConfiguredChannelIds(
        key,
        guildId
      );

    return {
      key,
      label: entry.label,
      type: entry.type,
      scope: entry.scope,
      multiple:
        entry.multiple === true,
      ids,
      id:
        entry.multiple === true
          ? null
          : (ids[0] || null)
    };
  });
}

async function migrateLegacyOverrides() {
  for (
    const [key, entry]
    of Object.entries(
      CHANNEL_CONFIGS
    )
  ) {
    const legacy =
      await BotConfigOverride
        .findOne({ key })
        .lean();

    if (!legacy) continue;

    const targetKey =
      getStorageKey(
        key,
        entry.scope === 'global'
          ? null
          : config.guildId
      );

    const targetExists =
      await BotConfigOverride
        .exists({
          key: targetKey
        });

    if (!targetExists) {
      await BotConfigOverride
        .updateOne(
          { _id: legacy._id },
          {
            $set: {
              key: targetKey
            }
          }
        );
    } else {
      await BotConfigOverride
        .deleteOne({
          _id: legacy._id
        });
    }
  }
}

function getConfigKeyFromStorageKey(
  storageKey
) {
  const raw =
    String(storageKey || '');

  const separatorIndex =
    raw.lastIndexOf(':');

  const key =
    separatorIndex >= 0
      ? raw.slice(
          separatorIndex + 1
        )
      : raw;

  return resolveConfigKey(key);
}

async function applyStoredChannelOverrides() {
  await migrateLegacyOverrides();

  overrideCache.clear();

  const rows =
    await BotConfigOverride
      .find({})
      .lean();

  for (const row of rows) {
    const key =
      getConfigKeyFromStorageKey(
        row.key
      );

    if (!key) continue;

    const entry =
      CHANNEL_CONFIGS[key];

    if (
      entry.multiple === true
    ) {
      const ids =
        normalizeChannelIds(
          row.value
        );

      overrideCache.set(
        row.key,
        JSON.stringify(ids)
      );

      continue;
    }

    if (
      !/^\d{17,20}$/.test(
        row.value
      )
    ) {
      continue;
    }

    overrideCache.set(
      row.key,
      row.value
    );
  }

  return overrideCache.size;
}

async function setChannelConfig(
  guildId,
  keyInput,
  channelId
) {
  const key =
    resolveConfigKey(keyInput);

  if (!key) {
    return {
      ok: false,
      reason: 'unknown_key'
    };
  }

  const entry =
    CHANNEL_CONFIGS[key];

  if (entry.multiple === true) {
    return {
      ok: false,
      reason: 'multiple_config',
      key
    };
  }

  const id =
    String(
      channelId || ''
    ).trim();

  if (
    !/^\d{17,20}$/.test(id)
  ) {
    return {
      ok: false,
      reason: 'invalid_id',
      key
    };
  }

  const storageKey =
    getStorageKey(
      key,
      guildId
    );

  await BotConfigOverride
    .findOneAndUpdate(
      { key: storageKey },
      {
        $set: {
          value: id
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

  overrideCache.set(
    storageKey,
    id
  );

  return {
    ok: true,
    key,
    entry,
    id
  };
}

async function setChannelConfigList(
  guildId,
  keyInput,
  channelIds
) {
  const key =
    resolveConfigKey(keyInput);

  if (!key) {
    return {
      ok: false,
      reason: 'unknown_key'
    };
  }

  const entry =
    CHANNEL_CONFIGS[key];

  if (entry.multiple !== true) {
    return {
      ok: false,
      reason: 'single_config',
      key
    };
  }

  const ids =
    normalizeChannelIds(
      channelIds
    );

  const storageKey =
    getStorageKey(
      key,
      guildId
    );

  const value =
    JSON.stringify(ids);

  await BotConfigOverride
    .findOneAndUpdate(
      { key: storageKey },
      {
        $set: {
          value
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

  overrideCache.set(
    storageKey,
    value
  );

  return {
    ok: true,
    key,
    entry,
    ids
  };
}

module.exports = {
  CHANNEL_CONFIGS,
  resolveConfigKey,
  getConfiguredChannelId,
  getConfiguredChannelIds,
  getChannelConfigList,
  applyStoredChannelOverrides,
  setChannelConfig,
  setChannelConfigList
};
