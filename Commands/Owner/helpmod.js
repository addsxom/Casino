const { EmbedBuilder } = require('discord.js');
const Owner = require('../../Models/Owner.js');
const { STAFF_LOG_CHANNELS } = require('../../utils/staffLogs.js');
const {
  getConfiguredChannelId
} = require('../../utils/configService.js');

async function isBotOwner(userId) {
  if (userId === process.env.BUYER) return true;

  return Boolean(
    await Owner.exists({ userId })
  );
}

function logChannelMention(
  guild,
  key
) {
  const logConfig =
    STAFF_LOG_CHANNELS[key];

  if (!logConfig) {
    return `**#${key}**`;
  }

  const channelId =
    getConfiguredChannelId(
      logConfig.configKey,
      guild.id
    );

  return channelId
    ? `<#${channelId}>`
    : `**#${key} non configuré**`;
}

function buildHelpModEmbed(message) {
  return new EmbedBuilder()
    .setColor(0x6b6de6)
    .setTitle('📘 Informations du staff')
    .setDescription(
      '**Guide des salons réservés au staff.**\n\n' +
      'Chaque salon de logs a un rôle précis afin de garder les informations claires et faciles à retrouver.'
    )
    .addFields(
      {
        name: '📘 Information',
        value:
          'Salon contenant ce guide et les informations importantes destinées au staff.',
        inline: false
      },
      {
        name: '💬 Staff Chat',
        value:
          'Salon de discussion interne entre les membres du staff.',
        inline: false
      },
      {
        name: '⚠️ Warn',
        value:
          `${logChannelMention(message.guild, 'warn')}\n` +
          'Historique du futur système de warnings.',
        inline: false
      },
      {
        name: '💰 Economy Logs',
        value:
          `${logChannelMention(message.guild, 'economy-logs')}\n` +
          'Gains et pertes liés aux jeux, daily, work, rob, récompenses de messages et actions admin sur les coins.',
        inline: false
      },
      {
        name: '🏦 Bank Logs',
        value:
          `${logChannelMention(message.guild, 'bank-logs')}\n` +
          'Dépôts et retraits entre la poche et la banque.',
        inline: false
      },
      {
        name: '💸 Transaction Logs',
        value:
          `${logChannelMention(message.guild, 'transaction-logs')}\n` +
          'Paiements entre membres avec la source des fonds et les soldes avant/après.',
        inline: false
      },
      {
        name: '💬 Message Logs',
        value:
          `${logChannelMention(message.guild, 'message-logs')}\n` +
          'Messages supprimés et modifiés, avec leur contenu lorsque celui-ci est disponible.',
        inline: false
      },
      {
        name: '⚙️ Server Logs',
        value:
          `${logChannelMention(message.guild, 'server-logs')}\n` +
          'Arrivées, départs et modifications importantes du serveur : salons, rôles et membres.',
        inline: false
      },
      {
        name: '🔊 Voice Logs',
        value:
          `${logChannelMention(message.guild, 'voice-logs')}\n` +
          'Connexions, déconnexions et déplacements entre les salons vocaux.',
        inline: false
      },
      {
        name: '🛡️ Moderation Logs',
        value:
          `${logChannelMention(message.guild, 'moderation-logs')}\n` +
          'Actions de modération comme **+clear** et **+clearctg**, puis les futures sanctions et actions staff.',
        inline: false
      },
      {
        name: '🎫 Ticket Logs',
        value:
          `${logChannelMention(message.guild, 'ticket-logs')}\n` +
          'Archive permanente des transcripts HTML lors de la fermeture des tickets.',
        inline: false
      }
    )
    .setFooter({
      text: `${message.guild.name} • Guide du staff`,
      iconURL: message.guild.iconURL({ dynamic: true }) || undefined
    })
    .setTimestamp();
}

module.exports = {
  name: 'helpmod',
  description: 'Envoie le guide des salons et logs du staff.',

  async execute(message) {
    if (!message.guild) return;

    if (!(await isBotOwner(message.author.id))) {
      return;
    }

    const embed = buildHelpModEmbed(message);

    await message.delete().catch(() => {});

    return message.channel.send({
      embeds: [embed]
    });
  }
};
