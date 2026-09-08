const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const ServerPrefix = require('../../Models/ServerPrefix');
const helpFeatures = require('../../utils/helpFeatures.js');

const CATEGORY_META = {
  General: { name: 'Général', emoji: '📌' },
  Recup: { name: 'Récompenses', emoji: '🎁' },
  'Gestion coins': { name: 'Gestion Coins', emoji: '💰' },
  Jeux: { name: 'Jeux', emoji: '🎰' },
  Admin: { name: 'Administration', emoji: '🛡️' },
  Owner: { name: 'Owner', emoji: '👑' }
};


function getCategoryMeta(category) {
  return CATEGORY_META[category] || {
    name: category,
    emoji: '📁'
  };
}

function cleanUsage(command) {
  if (!command.usage) return '';

  let usage = String(command.usage).trim();
  const lowerName = command.name.toLowerCase();

  if (usage.toLowerCase().startsWith(lowerName)) {
    usage = usage.slice(command.name.length).trim();
  }

  return usage ? ` ${usage}` : '';
}

function buildNavigationRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_previous')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('help_page')
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
  );
}

module.exports = {
  name: 'help',
  description: 'Affiche toutes les commandes et fonctionnalités du bot.',

  async execute(message) {
    let prefix = process.env.PREFIX || '+';

    if (message.guild) {
      const serverData = await ServerPrefix.findOne({
        guildId: message.guild.id
      });

      if (serverData?.prefix) {
        prefix = serverData.prefix;
      }
    }

    const commands = [...message.client.commands.values()]
      .filter(command => command?.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    const commandsByCategory = new Map();

    for (const command of commands) {
      const category = command.category || 'Autres';

      if (!commandsByCategory.has(category)) {
        commandsByCategory.set(category, []);
      }

      commandsByCategory.get(category).push(command);
    }

    const embeds = [];

    const preferredOrder = [
      'General',
      'Recup',
      'Gestion coins',
      'Jeux',
      'Admin',
      'Owner'
    ];

    const categories = [...commandsByCategory.keys()].sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);

      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, 'fr');
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    for (const category of categories) {
      const categoryCommands = commandsByCategory.get(category);
      const meta = getCategoryMeta(category);

      const commandText = categoryCommands
        .map(command => {
          const usage = cleanUsage(command);
          const names = [
            `\`${prefix}${command.name}${usage}\``,
            ...(Array.isArray(command.aliases)
              ? command.aliases.map(alias => `\`${prefix}${alias}\``)
              : [])
          ].join('/');

          return (
            `**${names}**\n` +
            `${command.description || 'Aucune description.'}`
          );
        })
        .join('\n\n');

      embeds.push(
        new EmbedBuilder()
          .setTitle(`${meta.emoji} ${meta.name}`)
          .setDescription(commandText || 'Aucune commande dans cette catégorie.')
          .setColor(0x6b6de6)
          .setFooter({
            text: `${categoryCommands.length} commande${categoryCommands.length > 1 ? 's' : ''} • Préfixe : ${prefix}`,
            iconURL: message.client.user.displayAvatarURL({ dynamic: true })
          })
      );
    }

    const featureText = helpFeatures
      .map(feature =>
        `${feature.emoji} **${feature.title}** — ${feature.description}`
      )
      .join('\n\n');

    embeds.push(
      new EmbedBuilder()
        .setTitle('⚙️ Fonctionnalités')
        .setDescription(featureText)
        .setColor(0x6b6de6)
        .setFooter({
          text: `Fonctionnalités disponibles • Préfixe : ${prefix}`,
          iconURL: message.client.user.displayAvatarURL({ dynamic: true })
        })
    );

    let currentPage = 0;
    const totalPages = embeds.length;

    const helpMessage = await message.channel.send({
      embeds: [embeds[currentPage]],
      components: [buildNavigationRow(currentPage, totalPages)]
    });

    const collector = helpMessage.createMessageComponentCollector({
      time: 300000
    });

    collector.on('collect', async interaction => {
      if (!['help_previous', 'help_next'].includes(interaction.customId)) {
        return;
      }

      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: '❌・Seule la personne qui a lancé +help peut utiliser ces boutons.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }

      if (interaction.customId === 'help_previous') {
        currentPage =
          currentPage === 0
            ? totalPages - 1
            : currentPage - 1;
      }

      if (interaction.customId === 'help_next') {
        currentPage =
          currentPage === totalPages - 1
            ? 0
            : currentPage + 1;
      }

      return interaction.update({
        embeds: [embeds[currentPage]],
        components: [buildNavigationRow(currentPage, totalPages)]
      });
    });

    collector.on('end', async () => {
      await helpMessage.edit({
        components: []
      }).catch(() => {});
    });
  }
};
