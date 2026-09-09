const { EmbedBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const {
  requireBotOwner
} = require('../../utils/ownerPermissions.js');
const {
  getChannelConfigList,
  resolveConfigKey,
  setChannelConfig
} = require('../../utils/configService.js');
const {
  updateMemberCount
} = require('../../utils/updateMemberCount.js');

function extractChannelId(args) {
  const raw = args.slice(1).join(' ');
  return raw.match(/\d{17,20}/)?.[0] || null;
}

function channelTypeMatches(entry, channel) {
  if (!channel) return false;

  if (entry.type === 'voice') {
    return channel.isVoiceBased?.() === true;
  }

  if (entry.type === 'text') {
    return (
      channel.isTextBased?.() === true &&
      channel.isVoiceBased?.() !== true
    );
  }

  return true;
}

async function getEntryStatus(message, entry) {
  if (!entry.id) {
    return {
      connected: false,
      channel: null
    };
  }

  const channel =
    message.client.channels.cache.get(entry.id) ||
    await message.client.channels.fetch(entry.id)
      .catch(() => null);

  if (!channel) {
    return {
      connected: false,
      channel: null
    };
  }

  if (
    entry.scope !== 'global' &&
    channel.guild?.id !== message.guild.id
  ) {
    return {
      connected: false,
      channel
    };
  }

  return {
    connected: channelTypeMatches(entry, channel),
    channel
  };
}

function formatChannelLine(entry, status) {
  const icon = status.connected ? '✅' : '❌';

  const channelText = status.connected
    ? `${status.channel} • \`${entry.id}\``
    : `\`${entry.id || 'Aucun ID'}\``;

  const scopeText = entry.scope === 'global'
    ? ' • global'
    : '';

  return (
    `${icon} **${entry.key}** → ${channelText}\n` +
    `-# ${entry.label}${scopeText}`
  );
}

async function applyImmediateSideEffect(
  message,
  key,
  channel
) {
  if (key === 'botvoice' && channel?.isVoiceBased?.()) {
    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator:
        channel.guild.voiceAdapterCreator
    });

    return;
  }

  if (
    key === 'welcome' &&
    channel?.isTextBased?.() &&
    channel.guild
  ) {
    await channel.guild.setSystemChannel(
      channel,
      'Mise à jour via +configlist'
    ).catch(() => {});
    return;
  }

  if (key === 'membercount' && channel?.guild) {
    await updateMemberCount(
      channel.guild
    ).catch(() => {});
  }
}

module.exports = {
  name: 'configlist',
  aliases: ['configs'],
  description:
    'Affiche ou modifie les IDs des salons configurés.',

  async execute(message, args) {
    if (!message.guild) return;
    if (!(await requireBotOwner(message))) return;

    const guildId = message.guild.id;
    const keyInput = args[0];

    if (!keyInput) {
      const entries =
        getChannelConfigList(guildId);

      const statuses = await Promise.all(
        entries.map(entry =>
          getEntryStatus(message, entry)
        )
      );

      const connectedCount =
        statuses.filter(status =>
          status.connected
        ).length;

      const lines = entries.map(
        (entry, index) =>
          formatChannelLine(
            entry,
            statuses[index]
          )
      );

      const embed = new EmbedBuilder()
        .setColor(
          connectedCount === entries.length
            ? 0x57f287
            : 0x6b6de6
        )
        .setTitle('⚙️ Configuration des salons')
        .setDescription(
          `✅ **${connectedCount}/${entries.length} connectés**\n` +
          `❌ **${entries.length - connectedCount} à configurer**\n\n` +
          lines.join('\n\n')
        )
        .setFooter({
          text:
            '+configlist <clé> <ID du salon>'
        })
        .setTimestamp();

      return message.reply({
        embeds: [embed]
      });
    }

    const key = resolveConfigKey(keyInput);

    if (!key) {
      return message.reply(
        '❌・Clé inconnue. Fais +configlist pour voir les clés disponibles.'
      );
    }

    const entries =
      getChannelConfigList(guildId);

    const current =
      entries.find(entry => entry.key === key);

    const channelId = extractChannelId(args);

    if (!channelId) {
      const status =
        await getEntryStatus(
          message,
          current
        );

      return message.reply(
        `${status.connected ? '✅' : '❌'} **${key}** → ` +
        `${status.connected ? status.channel : `\`${current.id || 'Aucun ID'}\``}\n` +
        `Utilise : +configlist ${key} <ID>`
      );
    }

    const channel =
      await message.client.channels.fetch(channelId)
        .catch(() => null);

    if (!channel) {
      return message.reply(
        '❌・Je ne trouve pas ce salon ou je n’y ai pas accès.'
      );
    }

    if (
      current.scope !== 'global' &&
      channel.guild?.id !== guildId
    ) {
      return message.reply(
        '❌・Ce salon appartient à un autre serveur. Utilise un salon de ce serveur.'
      );
    }

    if (!channelTypeMatches(current, channel)) {
      if (current.type === 'voice') {
        return message.reply(
          '❌・Cette configuration attend un salon vocal.'
        );
      }

      if (current.type === 'text') {
        return message.reply(
          '❌・Cette configuration attend un salon textuel.'
        );
      }

      return message.reply(
        '❌・Le type de ce salon n’est pas compatible.'
      );
    }

    const result = await setChannelConfig(
      guildId,
      key,
      channelId
    );

    if (!result.ok) {
      return message.reply(
        '❌・Impossible de mettre à jour cette configuration.'
      );
    }

    await applyImmediateSideEffect(
      message,
      key,
      channel
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✅ Configuration mise à jour')
      .setDescription(
        `**${result.entry.label}**\n` +
        `${channel} • \`${channelId}\`\n\n` +
        (
          result.entry.scope === 'global'
            ? '-# Configuration globale du bot.'
            : '-# Configuration sauvegardée uniquement pour ce serveur.'
        ) +
        '\n-# Conservé après redémarrage / git pull.'
      )
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }
};
