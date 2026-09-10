const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const {
  joinVoiceChannel
} = require('@discordjs/voice');

const {
  requireBotOwner
} = require('../../utils/ownerPermissions.js');

const {
  getChannelConfigList,
  resolveConfigKey,
  setChannelConfig,
  setChannelConfigList
} = require('../../utils/configService.js');

const {
  updateMemberCount
} = require('../../utils/updateMemberCount.js');
const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

const CONFIG_CATEGORY_META = [
  {
    key: 'general',
    name: 'Général',
    emoji: '⚙️',
    entries: [
      'botvoice',
      'welcome',
      'membercount',
      'misccmd',
      'botguildevents'
    ]
  },
  {
    key: 'rewards',
    name: 'Récompenses',
    emoji: '🎁',
    entries: [
      'rewards',
      'voicefarm',
      'afkfarm'
    ]
  },
  {
    key: 'games',
    name: 'Jeux',
    emoji: '🎰',
    entries: [
      'slots',
      'mines',
      'crash'
    ]
  },
  {
    key: 'logs',
    name: 'Logs',
    emoji: '📜',
    entries: [
      'warn',
      'economylogs',
      'banklogs',
      'transactionlogs',
      'messagelogs',
      'serverlogs',
      'voicelogs',
      'moderationlogs',
      'ticketlogs'
    ]
  }
];

function extractChannelIds(args) {
  const raw = args.join(' ');

  return [
    ...new Set(
      raw.match(/\d{17,20}/g) || []
    )
  ];
}

function channelTypeMatches(
  entry,
  channel
) {
  if (!channel) return false;

  if (entry.type === 'voice') {
    return (
      channel.isVoiceBased?.() === true
    );
  }

  if (entry.type === 'text') {
    return (
      channel.isTextBased?.() === true &&
      channel.isVoiceBased?.() !== true
    );
  }

  return true;
}

async function resolveChannelById(
  message,
  entry,
  id
) {
  if (!id) {
    return {
      id: null,
      connected: false,
      channel: null
    };
  }

  const channel =
    message.client.channels.cache.get(id) ||
    await message.client.channels
      .fetch(id)
      .catch(() => null);

  if (!channel) {
    return {
      id,
      connected: false,
      channel: null
    };
  }

  if (
    entry.scope !== 'global' &&
    channel.guild?.id !== message.guild.id
  ) {
    return {
      id,
      connected: false,
      channel
    };
  }

  return {
    id,
    connected:
      channelTypeMatches(
        entry,
        channel
      ),
    channel
  };
}

async function getEntryStatus(
  message,
  entry
) {
  if (entry.multiple) {
    const items = await Promise.all(
      (entry.ids || []).map(id =>
        resolveChannelById(
          message,
          entry,
          id
        )
      )
    );

    return {
      connected:
        items.length > 0 &&
        items.every(item =>
          item.connected
        ),
      items
    };
  }

  const item =
    await resolveChannelById(
      message,
      entry,
      entry.id
    );

  return {
    ...item,
    items: [item]
  };
}

function getLiveChannelLabel(item) {
  if (
    !item?.connected ||
    !item.channel
  ) {
    return (
      `\`${item?.id || 'Aucun ID'}\``
    );
  }

  return (
    `${item.channel} • \`${item.id}\``
  );
}

function formatChannelLine(
  entry,
  status
) {
  const icon =
    status.connected
      ? '✅'
      : '❌';

  const scopeText =
    entry.scope === 'global'
      ? ' • global'
      : '';

  if (entry.multiple) {
    const items =
      status.items || [];

    if (!items.length) {
      return (
        `${icon} **${entry.key}** → \`Aucun ID\`\n` +
        `-# ${entry.label} • multi${scopeText}`
      );
    }

    const channelLines =
      items.map(item => {
        const channelText =
          item.connected &&
          item.channel
            ? `${item.channel}`
            : `\`${item.id}\``;

        return (
          `-# ${channelText} • multi${scopeText}`
        );
      });

    return (
      `${icon} **${entry.key}** → **${items.length} vocal${items.length > 1 ? 'aux' : ''}**\n` +
      channelLines.join('\n')
    );
  }

  return (
    `${icon} **${entry.key}** → ${getLiveChannelLabel(status)}\n` +
    `-# ${entry.label}${scopeText}`
  );
}

function buildConfigPages(
  message,
  entries,
  statuses
) {
  const statusByKey =
    new Map(
      entries.map((entry, index) => [
        entry.key,
        statuses[index]
      ])
    );

  const entryByKey =
    new Map(
      entries.map(entry => [
        entry.key,
        entry
      ])
    );

  const assignedKeys = new Set();
  const categories = [];

  for (const meta of CONFIG_CATEGORY_META) {
    const categoryEntries =
      meta.entries
        .map(key => {
          const entry = entryByKey.get(key);
          if (entry) assignedKeys.add(key);
          return entry;
        })
        .filter(Boolean);

    if (categoryEntries.length) {
      categories.push({
        ...meta,
        entries: categoryEntries
      });
    }
  }

  const otherEntries =
    entries.filter(entry =>
      !assignedKeys.has(entry.key)
    );

  if (otherEntries.length) {
    categories.push({
      key: 'other',
      name: 'Autres',
      emoji: '📁',
      entries: otherEntries
    });
  }

  return categories.map(category => {
    const connectedCount =
      category.entries.filter(entry =>
        statusByKey.get(entry.key)
          ?.connected
      ).length;

    const lines =
      category.entries.map(entry =>
        formatChannelLine(
          entry,
          statusByKey.get(entry.key)
        )
      );

    return new EmbedBuilder()
      .setColor(
        connectedCount ===
          category.entries.length
          ? 0x57f287
          : 0x6b6de6
      )
      .setTitle(
        `${category.emoji} ${category.name}`
      )
      .setDescription(
        `✅ **${connectedCount}/${category.entries.length} connectés**\n` +
        `❌ **${category.entries.length - connectedCount} à configurer**\n\n` +
        lines.join('\n\n')
      )
      .setFooter({
        text:
          `${category.entries.length} configuration${category.entries.length > 1 ? 's' : ''} • +configlist <clé> <ID>`,
        iconURL:
          message.client.user
            .displayAvatarURL({
              dynamic: true
            })
      });
  });
}

function buildNavigationRow(
  page,
  totalPages
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'configlist_previous'
        )
        .setEmoji('◀️')
        .setStyle(
          ButtonStyle.Secondary
        ),
      new ButtonBuilder()
        .setCustomId(
          'configlist_page'
        )
        .setLabel(
          `${page + 1} / ${totalPages}`
        )
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(
          'configlist_next'
        )
        .setEmoji('▶️')
        .setStyle(
          ButtonStyle.Secondary
        )
    );
}

function buildActionRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'configlist_details'
        )
        .setLabel('Détails')
        .setEmoji('📖')
        .setStyle(
          ButtonStyle.Primary
        ),
      new ButtonBuilder()
        .setCustomId(
          'configlist_close'
        )
        .setLabel('Fermer')
        .setEmoji('✖️')
        .setStyle(
          ButtonStyle.Danger
        )
    );
}

function buildDetailsButtons() {
  return [
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'configlist_back'
          )
          .setLabel('Retour')
          .setEmoji('⬅️')
          .setStyle(
            ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'configlist_close'
          )
          .setLabel('Fermer')
          .setEmoji('✖️')
          .setStyle(
            ButtonStyle.Danger
          )
      )
  ];
}

function buildConfigDetailsEmbed() {
  return new EmbedBuilder()
    .setColor(0x6b6de6)
    .setTitle(
      '📖 Détails de la configuration'
    )
    .setDescription(
      '**Modifier un salon simple**\n' +
      '`+configlist rewards <ID>` — salon des récompenses\n' +
      '`+configlist afkfarm <ID>` — vocal AFK unique\n' +
      '`+configlist mines <ID>` — salon Mines\n' +
      '`+configlist slots <ID>` — salon Slots\n' +
      '`+configlist crash <ID>` — salon Crash\n' +
      '`+configlist misccmd <ID>` — commandes diverses\n' +
      '`+configlist ticketlogs <ID>` — transcripts des tickets\n\n' +
      '**Voir une configuration précise**\n' +
      '`+configlist rewards`\n' +
      '`+configlist afkfarm`\n' +
      '`+configlist voicefarm`\n\n' +
      '**Vocaux Farm multiples**\n' +
      '`+configlist voicefarm add <ID> [ID...]`\n' +
      'Ajoute un ou plusieurs vocaux sans supprimer les anciens.\n\n' +
      '`+configlist voicefarm remove <ID> [ID...]`\n' +
      'Retire un ou plusieurs vocaux précis.\n\n' +
      '`+configlist voicefarm set <ID> [ID...]`\n' +
      'Remplace toute la liste par les IDs donnés.\n\n' +
      '`+configlist voicefarm clear`\n' +
      'Vide complètement la liste.\n\n' +
      '`+configlist voicefarm <ID> <ID> ...`\n' +
      'Raccourci pour remplacer directement toute la liste.\n\n' +
      '**Fonctionnement**\n' +
      '• L’**ID** est toujours la référence principale.\n' +
      '• Le **nom actuel** du salon est relu directement depuis Discord.\n' +
      '• Renommer un salon ne casse donc pas sa configuration.\n' +
      '• Les configurations serveur sont conservées après redémarrage / git pull.\n' +
      '• **AFK Farm** reste limité à un seul vocal.\n' +
      '• **voicefarm** peut contenir plusieurs dizaines de vocaux.'
    )
    .setFooter({
      text:
        'Retour = catégorie précédente • Fermer = supprime les deux messages'
    })
    .setTimestamp();
}

function attachConfiglistButtons(
  message,
  sentMessage,
  pages
) {
  let currentPage = 0;
  let showingDetails = false;

  const collector =
    sentMessage
      .createMessageComponentCollector({
        time: 10 * 60 * 1000
      });

  collector.on(
    'collect',
    async interaction => {
      if (
        interaction.user.id !==
        message.author.id
      ) {
        return interaction.reply({
          ...replyEmbedPayload(
            'Ces boutons ne vous appartiennent pas.',
            { type: 'error' }
          ),
          flags:
            MessageFlags.Ephemeral
        }).catch(() => {});
      }

      if (
        interaction.customId ===
        'configlist_close'
      ) {
        collector.stop('closed');

        await interaction
          .deferUpdate()
          .catch(() => {});

        await message
          .delete()
          .catch(() => {});

        await sentMessage
          .delete()
          .catch(() => {});

        return;
      }

      if (
        interaction.customId ===
        'configlist_details'
      ) {
        showingDetails = true;

        return interaction.update({
          embeds: [
            buildConfigDetailsEmbed()
          ],
          components:
            buildDetailsButtons()
        }).catch(() => {});
      }

      if (
        interaction.customId ===
        'configlist_back'
      ) {
        showingDetails = false;

        return interaction.update({
          embeds: [
            pages[currentPage]
          ],
          components: [
            buildNavigationRow(
              currentPage,
              pages.length
            ),
            buildActionRow()
          ]
        }).catch(() => {});
      }

      if (showingDetails) {
        return interaction
          .deferUpdate()
          .catch(() => {});
      }

      if (
        interaction.customId ===
        'configlist_previous'
      ) {
        currentPage =
          currentPage === 0
            ? pages.length - 1
            : currentPage - 1;
      } else if (
        interaction.customId ===
        'configlist_next'
      ) {
        currentPage =
          currentPage ===
            pages.length - 1
            ? 0
            : currentPage + 1;
      } else {
        return interaction
          .deferUpdate()
          .catch(() => {});
      }

      return interaction.update({
        embeds: [
          pages[currentPage]
        ],
        components: [
          buildNavigationRow(
            currentPage,
            pages.length
          ),
          buildActionRow()
        ]
      }).catch(() => {});
    }
  );

  collector.on(
    'end',
    async (_, reason) => {
      if (
        reason === 'closed' ||
        !sentMessage.editable
      ) {
        return;
      }

      await sentMessage.edit({
        components: []
      }).catch(() => {});
    }
  );
}

async function applyImmediateSideEffect(
  message,
  key,
  channel
) {
  if (
    key === 'botvoice' &&
    channel?.isVoiceBased?.()
  ) {
    joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator:
        channel.guild
          .voiceAdapterCreator
    });

    return;
  }

  if (
    key === 'welcome' &&
    channel?.isTextBased?.() &&
    channel.guild
  ) {
    await channel.guild
      .setSystemChannel(
        channel,
        'Mise à jour via +configlist'
      )
      .catch(() => {});

    return;
  }

  if (
    key === 'membercount' &&
    channel?.guild
  ) {
    await updateMemberCount(
      channel.guild
    ).catch(() => {});
  }
}

function buildMultiHelp(key) {
  return (
    '**Commandes :**\n' +
    `\`+configlist ${key} add <ID> [ID...]\`\n` +
    `\`+configlist ${key} remove <ID> [ID...]\`\n` +
    `\`+configlist ${key} set <ID> [ID...]\`\n` +
    `\`+configlist ${key} clear\`\n` +
    `-# Tu peux aussi faire directement +configlist ${key} <ID> <ID> pour remplacer toute la liste.`
  );
}

async function replyMultiStatus(
  message,
  entry,
  status
) {
  const items = status.items || [];

  const lines =
    items.length
      ? items.map(
          (item, index) =>
            `${item.connected ? '✅' : '❌'} **${index + 1}.** ${getLiveChannelLabel(item)}`
        )
      : [
          '❌ Aucun vocal configuré.'
        ];

  const embed =
    new EmbedBuilder()
      .setColor(
        status.connected
          ? 0x57f287
          : 0x6b6de6
      )
      .setTitle(
        `🎙️ ${entry.label}`
      )
      .setDescription(
        lines.join('\n') +
        '\n\n' +
        buildMultiHelp(entry.key)
      )
      .setFooter({
        text:
          'Les noms sont lus en direct depuis Discord • l’ID reste la référence'
      })
      .setTimestamp();

  return message.reply({
    embeds: [embed]
  });
}

async function validateChannels(
  message,
  entry,
  ids
) {
  const results = await Promise.all(
    ids.map(id =>
      resolveChannelById(
        message,
        entry,
        id
      )
    )
  );

  const invalid =
    results.filter(result =>
      !result.connected
    );

  return {
    ok: invalid.length === 0,
    results,
    invalid
  };
}

module.exports = {
  name: 'configlist',
  aliases: ['configs'],
  description:
    'Affiche ou modifie les IDs des salons configurés.',

  async execute(message, args) {
    if (!message.guild) return;

    if (
      !(await requireBotOwner(message))
    ) {
      return;
    }

    const guildId =
      message.guild.id;

    const keyInput =
      args[0];

    if (!keyInput) {
      const entries =
        getChannelConfigList(
          guildId
        );

      const statuses =
        await Promise.all(
          entries.map(entry =>
            getEntryStatus(
              message,
              entry
            )
          )
        );

      const pages =
        buildConfigPages(
          message,
          entries,
          statuses
        );

      if (!pages.length) {
        return message.reply(
          replyEmbedPayload(
            'Aucune configuration de salon disponible.',
            { type: 'warning' }
          )
        );
      }

      const sentMessage =
        await message.reply({
          embeds: [pages[0]],
          components: [
            buildNavigationRow(
              0,
              pages.length
            ),
            buildActionRow()
          ]
        });

      attachConfiglistButtons(
        message,
        sentMessage,
        pages
      );

      return sentMessage;
    }

    const key =
      resolveConfigKey(
        keyInput
      );

    if (!key) {
      return message.reply(
        replyEmbedPayload(
          'Clé inconnue. Fais **+configlist** pour voir les clés disponibles.',
          { type: 'error' }
        )
      );
    }

    const entries =
      getChannelConfigList(
        guildId
      );

    const current =
      entries.find(entry =>
        entry.key === key
      );

    if (!current) {
      return message.reply(
        replyEmbedPayload(
          'Configuration introuvable.',
          { type: 'error' }
        )
      );
    }

    if (current.multiple) {
      const actionRaw =
        String(
          args[1] || ''
        ).toLowerCase();

      if (!actionRaw) {
        const status =
          await getEntryStatus(
            message,
            current
          );

        return replyMultiStatus(
          message,
          current,
          status
        );
      }

      const knownActions =
        new Set([
          'add',
          'remove',
          'set',
          'clear'
        ]);

      const action =
        knownActions.has(actionRaw)
          ? actionRaw
          : 'set';

      const idArgs =
        knownActions.has(actionRaw)
          ? args.slice(2)
          : args.slice(1);

      const ids =
        extractChannelIds(idArgs);

      if (action === 'clear') {
        const result =
          await setChannelConfigList(
            guildId,
            key,
            []
          );

        if (!result.ok) {
          return message.reply(
            replyEmbedPayload(
              'Impossible de vider cette configuration.',
              { type: 'error' }
            )
          );
        }

        return message.reply(
          replyEmbedPayload(
            `**${current.label}** vidé.\nTant que **voicefarm** est vide, le système vocal normal garde son comportement actuel.`,
            {
              type: 'success',
              title:
                '⚙️ Configuration vidée'
            }
          )
        );
      }

      if (!ids.length) {
        return message.reply(
          replyEmbedPayload(
            `Ajoute au moins un ID de salon vocal.\n\n${buildMultiHelp(key)}`,
            { type: 'error' }
          )
        );
      }

      if (action !== 'remove') {
        const validation =
          await validateChannels(
            message,
            current,
            ids
          );

        if (!validation.ok) {
          const invalidIds =
            validation.invalid
              .map(item =>
                `\`${item.id}\``
              )
              .join(', ');

          return message.reply(
            replyEmbedPayload(
              `Ces IDs ne correspondent pas à des vocaux accessibles de ce serveur : ${invalidIds}`,
              { type: 'error' }
            )
          );
        }
      }

      let nextIds = [];

      if (action === 'add') {
        nextIds = [
          ...new Set([
            ...(current.ids || []),
            ...ids
          ])
        ];
      } else if (
        action === 'remove'
      ) {
        const removeSet =
          new Set(ids);

        nextIds =
          (current.ids || [])
            .filter(id =>
              !removeSet.has(id)
            );
      } else {
        nextIds = ids;
      }

      const result =
        await setChannelConfigList(
          guildId,
          key,
          nextIds
        );

      if (!result.ok) {
        return message.reply(
          replyEmbedPayload(
            'Impossible de mettre à jour cette liste.',
            { type: 'error' }
          )
        );
      }

      const updated =
        getChannelConfigList(
          guildId
        ).find(entry =>
          entry.key === key
        );

      const status =
        await getEntryStatus(
          message,
          updated
        );

      const actionLabel =
        action === 'add'
          ? 'ajouté(s)'
          : action === 'remove'
            ? 'retiré(s)'
            : 'remplacée';

      const embed =
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(
            '✅ Configuration mise à jour'
          )
          .setDescription(
            `**${current.label}** • ${actionLabel}\n` +
            `**${result.ids.length} vocal${result.ids.length > 1 ? 'aux' : ''} configuré${result.ids.length > 1 ? 's' : ''}**\n\n` +
            (
              status.items.length
                ? status.items
                    .map(item =>
                      `${item.connected ? '✅' : '❌'} ${getLiveChannelLabel(item)}`
                    )
                    .join('\n')
                : 'Aucun vocal configuré.'
            ) +
            '\n\n-# Sauvegardé uniquement pour ce serveur.'
          )
          .setTimestamp();

      return message.reply({
        embeds: [embed]
      });
    }

    const channelIds =
      extractChannelIds(
        args.slice(1)
      );

    const channelId =
      channelIds[0] || null;

    if (!channelId) {
      const status =
        await getEntryStatus(
          message,
          current
        );

      return message.reply(
        replyEmbedPayload(
          `**${key}** → ${getLiveChannelLabel(status)}\n` +
          `${current.label}\n\n` +
          `Utilise : \`+configlist ${key} <ID>\``,
          {
            type:
              status.connected
                ? 'success'
                : 'warning',
            title:
              '⚙️ Configuration'
          }
        )
      );
    }

    const validation =
      await validateChannels(
        message,
        current,
        [channelId]
      );

    if (!validation.ok) {
      const channel =
        validation.results[0]
          ?.channel;

      if (
        channel &&
        current.scope !== 'global' &&
        channel.guild?.id !== guildId
      ) {
        return message.reply(
          replyEmbedPayload(
            'Ce salon appartient à un autre serveur. Utilise un salon de ce serveur.',
            { type: 'error' }
          )
        );
      }

      if (
        channel &&
        !channelTypeMatches(
          current,
          channel
        )
      ) {
        if (current.type === 'voice') {
          return message.reply(
            replyEmbedPayload(
              'Cette configuration attend un salon vocal.',
              { type: 'error' }
            )
          );
        }

        if (current.type === 'text') {
          return message.reply(
            replyEmbedPayload(
              'Cette configuration attend un salon textuel.',
              { type: 'error' }
            )
          );
        }
      }

      return message.reply(
        replyEmbedPayload(
          'Je ne trouve pas cet ID de salon ou je n’y ai pas accès.',
          { type: 'error' }
        )
      );
    }

    const channel =
      validation.results[0]
        .channel;

    const result =
      await setChannelConfig(
        guildId,
        key,
        channelId
      );

    if (!result.ok) {
      return message.reply(
        replyEmbedPayload(
          'Impossible de mettre à jour cette configuration.',
          { type: 'error' }
        )
      );
    }

    await applyImmediateSideEffect(
      message,
      key,
      channel
    );

    const immediateText =
      key === 'rewards'
        ? '\n-# Les prochaines notifications de récompenses utiliseront immédiatement ce salon.'
        : '';

    const embed =
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(
          '✅ Configuration mise à jour'
        )
        .setDescription(
          `**${result.entry.label}**\n` +
          `${getLiveChannelLabel({
            connected: true,
            channel,
            id: channelId
          })}\n\n` +
          (
            result.entry.scope ===
              'global'
              ? '-# Configuration globale du bot.'
              : '-# Configuration sauvegardée uniquement pour ce serveur.'
          ) +
          immediateText +
          '\n-# Le nom affiché sera toujours relu directement depuis Discord.'
        )
        .setTimestamp();

    return message.reply({
      embeds: [embed]
    });
  }
};
