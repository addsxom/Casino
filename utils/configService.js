const config = require('../config/botConfig.js');
const BotConfigOverride =
  require('../Models/BotConfigOverride.js');

const CHANNEL_CONFIGS = {
  botvoice: {
    label: 'Vocal du bot',
    path: ['channels', 'botVoice', 'id'],
    type: 'voice',
    aliases: ['bot-voice', 'voicebot']
  },
  welcome: {
    label: 'Salon de bienvenue',
    path: ['channels', 'welcome'],
    type: 'text',
    aliases: ['bienvenue']
  },
  membercount: {
    label: 'Compteur de membres',
    path: ['channels', 'memberCount'],
    type: 'any',
    aliases: ['members', 'membres']
  },
  rewards: {
    label: 'Récompenses messages/vocal',
    path: ['channels', 'rewards'],
    type: 'text',
    aliases: ['reward', 'reward-voc']
  },
  botguildevents: {
    label: 'Arrivée/départ du bot',
    path: ['channels', 'botGuildEvents'],
    type: 'text',
    aliases: ['guildevents', 'bot-events']
  },
  slots: {
    label: 'Slots',
    path: ['channels', 'games', 'slots'],
    type: 'text',
    aliases: ['slot']
  },
  mines: {
    label: 'Mines',
    path: ['channels', 'games', 'mines'],
    type: 'text'
  },
  warn: {
    label: 'Logs warn',
    path: ['channels', 'staffLogs', 'warn', 'id'],
    type: 'text'
  },
  economylogs: {
    label: 'Logs économie',
    path: ['channels', 'staffLogs', 'economy', 'id'],
    type: 'text',
    aliases: ['economy', 'economy-logs']
  },
  banklogs: {
    label: 'Logs banque',
    path: ['channels', 'staffLogs', 'bank', 'id'],
    type: 'text',
    aliases: ['bank', 'bank-logs']
  },
  transactionlogs: {
    label: 'Logs transactions',
    path: ['channels', 'staffLogs', 'transaction', 'id'],
    type: 'text',
    aliases: ['transaction', 'transaction-logs']
  },
  messagelogs: {
    label: 'Logs messages',
    path: ['channels', 'staffLogs', 'message', 'id'],
    type: 'text',
    aliases: ['message', 'message-logs']
  },
  serverlogs: {
    label: 'Logs serveur',
    path: ['channels', 'staffLogs', 'server', 'id'],
    type: 'text',
    aliases: ['server', 'server-logs']
  },
  voicelogs: {
    label: 'Logs vocal',
    path: ['channels', 'staffLogs', 'voice', 'id'],
    type: 'text',
    aliases: ['voice', 'voice-logs']
  },
  moderationlogs: {
    label: 'Logs modération',
    path: ['channels', 'staffLogs', 'moderation', 'id'],
    type: 'text',
    aliases: ['moderation', 'moderation-logs']
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

  for (const [key, entry] of Object.entries(CHANNEL_CONFIGS)) {
    if (normalizeKey(key) === normalized) {
      return key;
    }

    if (
      (entry.aliases || []).some(
        alias => normalizeKey(alias) === normalized
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

function setPathValue(path, value) {
  let current = config;

  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]];
  }

  current[path[path.length - 1]] = value;
}

function getChannelConfigList() {
  return Object.entries(CHANNEL_CONFIGS).map(
    ([key, entry]) => ({
      key,
      label: entry.label,
      type: entry.type,
      id: String(getPathValue(entry.path) || '')
    })
  );
}

async function applyStoredChannelOverrides() {
  const rows = await BotConfigOverride.find({
    key: { $in: Object.keys(CHANNEL_CONFIGS) }
  }).lean();

  for (const row of rows) {
    const entry = CHANNEL_CONFIGS[row.key];
    if (!entry || !/^\d{17,20}$/.test(row.value)) {
      continue;
    }

    setPathValue(entry.path, row.value);
  }

  return rows.length;
}

async function setChannelConfig(keyInput, channelId) {
  const key = resolveConfigKey(keyInput);

  if (!key) {
    return {
      ok: false,
      reason: 'unknown_key'
    };
  }

  const id = String(channelId || '').trim();

  if (!/^\d{17,20}$/.test(id)) {
    return {
      ok: false,
      reason: 'invalid_id',
      key
    };
  }

  await BotConfigOverride.findOneAndUpdate(
    { key },
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

  setPathValue(
    CHANNEL_CONFIGS[key].path,
    id
  );

  return {
    ok: true,
    key,
    entry: CHANNEL_CONFIGS[key],
    id
  };
}

module.exports = {
  CHANNEL_CONFIGS,
  resolveConfigKey,
  getChannelConfigList,
  applyStoredChannelOverrides,
  setChannelConfig
};
