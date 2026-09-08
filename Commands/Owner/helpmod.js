const { EmbedBuilder } = require('discord.js');
const Owner = require('../../Models/Owner.js');
const { STAFF_LOG_CHANNELS } = require('../../utils/staffLogs.js');

async function isBotOwner(userId) {
  if (userId === process.env.BUYER) return true;

  return Boolean(
    await Owner.exists({ userId })
  );
}

function logChannelMention(key) {
  const config = STAFF_LOG_CHANNELS[key];

  if (!config) {
    return `**#${key}**`;
  }

  return `<#${config.id}>`;
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
          `${logChannelMention('warn')}\n` +
          'Historique du futur système de warnings.',
        inline: false
      },
      {
        name: '💰 Economy Logs',
        value:
          `${logChannelMention('economy-logs')}\n` +
          'Gains et pertes liés aux jeux, daily, work, rob, récompenses de messages et actions admin sur les coins.',
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
          'Paiements entre membres avec la source des fonds et les soldes avant/après.',
        inline: false
      },
      {
        name: '💬 Message Logs',
        value:
          `${logChannelMention('message-logs')}\n` +
          'Messages supprimés et modifiés, avec leur contenu lorsque celui-ci est disponible.',
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
