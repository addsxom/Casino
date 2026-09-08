const {
  ChannelType,
  EmbedBuilder
} = require('discord.js');
const Owner = require('../../Models/Owner.js');
const { STAFF_LOG_CHANNELS } = require('../../utils/staffLogs.js');

const INFORMATION_CHANNEL_NAME = 'information';
const STAFF_CHAT_NAMES = ['staff-chat', 'staff chat'];

async function isBotOwner(userId) {
  if (userId === process.env.BUYER) return true;

  return Boolean(
    await Owner.exists({ userId })
  );
}

function normalizeName(name) {
  return String(name || '').toLowerCase().trim();
}

function findStaffChat(guild) {
  return guild.channels.cache.find(channel => {
    if (channel.type !== ChannelType.GuildText) return false;

    const name = normalizeName(channel.name);

    return STAFF_CHAT_NAMES.some(expected =>
      name === expected || name.endsWith(expected)
    );
  }) || null;
}

function findInformationChannel(guild, parentId = null) {
  return guild.channels.cache.find(channel => {
    if (channel.type !== ChannelType.GuildText) return false;
    if (parentId && channel.parentId !== parentId) return false;

    const name = normalizeName(channel.name);
    return name === INFORMATION_CHANNEL_NAME ||
      name.endsWith(INFORMATION_CHANNEL_NAME);
  }) || null;
}

function clonePermissionOverwrites(channel) {
  return channel.permissionOverwrites.cache.map(overwrite => ({
    id: overwrite.id,
    type: overwrite.type,
    allow: overwrite.allow.bitfield,
    deny: overwrite.deny.bitfield
  }));
}

function logChannelMention(key) {
  const config = STAFF_LOG_CHANNELS[key];

  if (!config) {
    return `**#${key}**`;
  }

  return `<#${config.id}> • \`${config.name}\``;
}

function buildHelpModEmbed(guild, staffChat, informationChannel) {
  return new EmbedBuilder()
    .setColor(0x6b6de6)
    .setTitle('📘 Informations du staff')
    .setDescription(
      'Ce salon résume le rôle de chaque espace réservé au staff et des différents logs.\n' +
      'Les salons de logs sont alimentés automatiquement par le bot.'
    )
    .addFields(
      {
        name: '📘 Information',
        value:
          `${informationChannel}\n` +
          'Guide interne du staff. La commande **+helpmod** permet de republier cette interface.',
        inline: false
      },
      {
        name: '💬 Staff Chat',
        value:
          `${staffChat}\n` +
          'Salon de discussion interne entre les membres du staff.',
        inline: false
      },
      {
        name: '⚠️ Warn',
        value:
          `${logChannelMention('warn')}\n` +
          'Réservé au futur système de warnings et à leur historique.',
        inline: false
      },
      {
        name: '💰 Economy Logs',
        value:
          `${logChannelMention('economy-logs')}\n` +
          'Gains et pertes : jeux, daily, work, rob, récompenses de messages et actions admin sur les coins.',
        inline: false
      },
      {
        name: '🏦 Bank Logs',
        value:
          `${logChannelMention('bank-logs')}\n` +
          'Dépôts et retraits entre la poche et la banque.',
        inline: false
      },
      {
        name: '💸 Transaction Logs',
        value:
          `${logChannelMention('transaction-logs')}\n` +
          'Paiements entre membres, avec source des fonds et soldes avant/après.',
        inline: false
      },
      {
        name: '💬 Message Logs',
        value:
          `${logChannelMention('message-logs')}\n` +
          'Messages supprimés ou modifiés, avec leur contenu lorsque celui-ci est disponible.',
        inline: false
      },
      {
        name: '⚙️ Server Logs',
        value:
          `${logChannelMention('server-logs')}\n` +
          'Arrivées, départs et modifications importantes du serveur : salons, rôles et membres.',
        inline: false
      },
      {
        name: '🔊 Voice Logs',
        value:
          `${logChannelMention('voice-logs')}\n` +
          'Connexions, déconnexions et déplacements entre les salons vocaux.',
        inline: false
      },
      {
        name: '🛡️ Moderation Logs',
        value:
          `${logChannelMention('moderation-logs')}\n` +
          'Actions de modération comme **+clear**, puis les futures sanctions et actions staff.',
        inline: false
      }
    )
    .setFooter({
      text: `${guild.name} • Guide du staff`,
      iconURL: guild.iconURL({ dynamic: true }) || undefined
    })
    .setTimestamp();
}

async function ensureInformationChannel(guild, staffChat) {
  let informationChannel =
    findInformationChannel(guild, staffChat.parentId);

  if (!informationChannel) {
    informationChannel = await guild.channels.create({
      name: INFORMATION_CHANNEL_NAME,
      type: ChannelType.GuildText,
      parent: staffChat.parentId || undefined,
      permissionOverwrites: clonePermissionOverwrites(staffChat),
      reason: 'Création du salon d’informations staff'
    });
  }

  if (informationChannel.parentId !== staffChat.parentId) {
    await informationChannel.setParent(
      staffChat.parentId,
      {
        lockPermissions: false,
        reason: 'Placement du salon information avec le staff'
      }
    );
  }

  if (informationChannel.rawPosition > staffChat.rawPosition) {
    await informationChannel.setPosition(
      staffChat.rawPosition,
      {
        reason: 'Placement du salon information au-dessus de staff-chat'
      }
    );
  }

  return informationChannel;
}

async function removePreviousHelpModEmbed(channel, botUserId) {
  const messages = await channel.messages.fetch({
    limit: 50
  }).catch(() => null);

  if (!messages) return;

  const oldPanels = messages.filter(message =>
    message.author?.id === botUserId &&
    message.embeds?.some(embed =>
      embed.title === '📘 Informations du staff'
    )
  );

  for (const oldPanel of oldPanels.values()) {
    await oldPanel.delete().catch(() => {});
  }
}

module.exports = {
  name: 'helpmod',
  description: 'Publie le guide des salons et logs du staff.',

  async execute(message) {
    if (!message.guild) return;

    if (!(await isBotOwner(message.author.id))) {
      return;
    }

    try {
      await message.guild.channels.fetch().catch(() => null);

      const staffChat = findStaffChat(message.guild);

      if (!staffChat) {
        return message.reply(
          '❌・Impossible de trouver le salon **staff-chat**.'
        );
      }

      const informationChannel =
        await ensureInformationChannel(
          message.guild,
          staffChat
        );

      await removePreviousHelpModEmbed(
        informationChannel,
        message.client.user.id
      );

      const embed = buildHelpModEmbed(
        message.guild,
        staffChat,
        informationChannel
      );

      await informationChannel.send({
        embeds: [embed]
      });

      await message.delete().catch(() => {});

      const confirmation = await message.channel.send(
        `✅・Guide du staff publié dans ${informationChannel}.`
      ).catch(() => null);

      if (confirmation) {
        setTimeout(() => {
          confirmation.delete().catch(() => {});
        }, 3000);
      }
    } catch (error) {
      console.error(
        'Erreur +helpmod :',
        error?.code || error?.message || error
      );

      return message.reply(
        '❌・Impossible de créer ou mettre à jour le guide du staff.'
      ).catch(() => {});
    }
  }
};
