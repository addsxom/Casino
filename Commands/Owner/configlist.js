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

function formatChannelLine(message, entry) {
  const channel =
    message.client.channels.cache.get(entry.id);

  const name = channel?.name
    ? ` • #${channel.name}`
    : '';

  return (
    `**${entry.key}** → <#${entry.id}>${name}\n` +
    `-# ${entry.label}`
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

    const keyInput = args[0];

    if (!keyInput) {
      const entries = getChannelConfigList();

      const embed = new EmbedBuilder()
        .setColor(0x6b6de6)
        .setTitle('⚙️ Configuration des salons')
        .setDescription(
          entries
            .map(entry =>
              formatChannelLine(message, entry)
            )
            .join('\n\n')
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

    const channelId = extractChannelId(args);

    if (!channelId) {
      const current = getChannelConfigList()
        .find(entry => entry.key === key);

      return message.reply(
        `⚙️ **${key}** est actuellement configuré sur <#${current.id}>.\n` +
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

    const current =
      getChannelConfigList()
        .find(entry => entry.key === key);

    if (
      current.type === 'text' &&
      !channel.isTextBased?.()
    ) {
      return message.reply(
        '❌・Cette configuration attend un salon textuel.'
      );
    }

    if (
      current.type === 'voice' &&
      !channel.isVoiceBased?.()
    ) {
      return message.reply(
        '❌・Cette configuration attend un salon vocal.'
      );
    }

    const result = await setChannelConfig(
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
        `<#${channelId}> • ${channelId}\n\n` +
        '-# Sauvegardé dans MongoDB et conservé après redémarrage / git pull.'
      )
      .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }
};
