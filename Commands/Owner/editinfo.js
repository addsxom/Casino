const {
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');

const mongoose = require('mongoose');

const BotInfo =
  require('../../Models/BotInfo');

const {
  isBotOwner
} = require('../../utils/ownerPermissions.js');

const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

const {
  DEFAULT_DYNAMIC_ACTIVITY,
  normalizeActivityTemplate,
  renderActivityText
} = require('../../utils/activityText.js');

const ACTIVITY_TYPES = {
  PLAYING: ActivityType.Playing,
  STREAMING: ActivityType.Streaming,
  LISTENING: ActivityType.Listening,
  WATCHING: ActivityType.Watching,
  COMPETING: ActivityType.Competing
};

const VALID_STATUSES = [
  'online',
  'idle',
  'dnd',
  'invisible'
];

const STATUS_META = {
  online: {
    label: 'Online',
    emoji: '🟢'
  },
  idle: {
    label: 'Idle',
    emoji: '🌙'
  },
  dnd: {
    label: 'DND',
    emoji: '🔴'
  },
  invisible: {
    label: 'Invisible',
    emoji: '⚫'
  }
};

const ACTIVITY_META = {
  PLAYING: {
    label: 'Playing',
    emoji: '🎮'
  },
  STREAMING: {
    label: 'Streaming',
    emoji: '🟣'
  },
  LISTENING: {
    label: 'Listening',
    emoji: '🎧'
  },
  WATCHING: {
    label: 'Watching',
    emoji: '👀'
  },
  COMPETING: {
    label: 'Competing',
    emoji: '🏆'
  }
};

function getStatusDisplay(status) {
  const meta =
    STATUS_META[status] ||
    STATUS_META.online;

  return (
    meta.emoji +
    ' ' +
    meta.label
  );
}

function getActivityDisplay(type) {
  const key =
    getActivityTypeName(type);

  const meta =
    ACTIVITY_META[key] ||
    ACTIVITY_META.LISTENING;

  return (
    meta.emoji +
    ' ' +
    meta.label
  );
}

function separator() {
  return new SeparatorBuilder()
    .setDivider(true);
}

function restoreClientToken(
  client,
  token
) {
  if (!token) return;

  client.token = token;
  client.rest.setToken(token);
}

function resolveActivityType(
  value
) {
  if (
    typeof value === 'number'
  ) {
    return value;
  }

  const key =
    String(
      value || 'LISTENING'
    ).toUpperCase();

  return (
    ACTIVITY_TYPES[key] ??
    ActivityType.Listening
  );
}

function getActivityTypeName(
  value
) {
  if (
    typeof value === 'string'
  ) {
    const key =
      value.toUpperCase();

    if (
      ACTIVITY_TYPES[key] !==
      undefined
    ) {
      return key;
    }
  }

  const entry =
    Object.entries(
      ACTIVITY_TYPES
    ).find(
      ([, type]) =>
        type === value
    );

  return (
    entry?.[0] ||
    'LISTENING'
  );
}

function getActivityOptions(
  type,
  streamingUrl
) {
  const options = { type };

  if (
    type ===
      ActivityType.Streaming &&
    streamingUrl
  ) {
    options.url =
      streamingUrl;
  }

  return options;
}

function currentActivityText(bot) {
  return (
    bot.user.presence
      ?.activities?.[0]
      ?.name ||
    bot.user.username
  );
}

function normalizeTwitchUrl(
  value
) {
  let raw =
    String(value || '')
      .trim();

  if (!raw) {
    throw new Error(
      'EMPTY_VALUE'
    );
  }

  if (
    !/^https?:\/\//i.test(raw)
  ) {
    raw =
      'https://' + raw;
  }

  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      'INVALID_TWITCH_URL'
    );
  }

  const hostname =
    parsed.hostname
      .toLowerCase()
      .replace(/^www\./, '');

  const parts =
    parsed.pathname
      .split('/')
      .filter(Boolean);

  const channel =
    parts[0] || '';

  if (
    hostname !==
      'twitch.tv' ||
    !channel ||
    !/^[a-zA-Z0-9_]+$/.test(
      channel
    )
  ) {
    throw new Error(
      'INVALID_TWITCH_URL'
    );
  }

  return (
    'https://www.twitch.tv/' +
    channel
  );
}

function buildRuntimeActivity(
  bot,
  botInfo
) {
  const text1 =
    normalizeActivityTemplate(
      botInfo.activityText
    );

  const text2 =
    normalizeActivityTemplate(
      botInfo.activityText2
    );

  const type =
    resolveActivityType(
      botInfo.activityType
    );

  bot.activityRotation = {
    texts: [
      text1,
      text2
    ].filter(Boolean),
    type,
    streamingUrl:
      botInfo.streamingUrl ||
      '',
    index: 0
  };

  const firstText =
    bot.activityRotation
      .texts[0];

  if (!firstText) {
    return;
  }

  bot.user.setActivity(
    renderActivityText(
      firstText,
      bot,
      process.env.PREFIX ||
        '+'
    ),
    getActivityOptions(
      type,
      bot.activityRotation
        .streamingUrl
    )
  );
}

function buildMainButtons(botInfo) {
  const status =
    botInfo.status ||
    'online';

  const activity =
    getActivityTypeName(
      botInfo.activityType
    );

  const statusEmoji =
    STATUS_META[status]
      ?.emoji ||
    STATUS_META.online.emoji;

  const activityEmoji =
    ACTIVITY_META[activity]
      ?.emoji ||
    ACTIVITY_META.LISTENING
      .emoji;

  const row1 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'editbot_name'
          )
          .setLabel('Nom')
          .setEmoji('✏️')
          .setStyle(
            ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_activity'
          )
          .setLabel('Activité')
          .setEmoji(
            activityEmoji
          )
          .setStyle(
            ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_status'
          )
          .setLabel('Statut')
          .setEmoji(
            statusEmoji
          )
          .setStyle(
            ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_avatar'
          )
          .setLabel('Avatar')
          .setEmoji('🖼️')
          .setStyle(
            ButtonStyle.Secondary
          )
      );

  const row2 =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'editbot_text1'
          )
          .setLabel('Texte 1')
          .setEmoji('1️⃣')
          .setStyle(
            ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_text2'
          )
          .setLabel('Texte 2')
          .setEmoji('2️⃣')
          .setStyle(
            ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_close'
          )
          .setLabel('Fermer')
          .setEmoji('✖️')
          .setStyle(
            ButtonStyle.Danger
          )
      );

  return [
    row1,
    row2
  ];
}

function buildMainContainer(
  botInfo,
  bot
) {
  const prefix =
    process.env.PREFIX ||
    '+';

  const text1 =
    botInfo.activityText
      ? renderActivityText(
          botInfo.activityText,
          bot,
          prefix
        )
      : 'Non défini';

  const text2 =
    botInfo.activityText2
      ? renderActivityText(
          botInfo.activityText2,
          bot,
          prefix
        )
      : 'Non défini';

  const activityType =
    getActivityTypeName(
      botInfo.activityType
    );

  const status =
    botInfo.status ||
    bot.user.presence
      ?.status ||
    'online';

  let twitchLine = '';

  if (
    activityType ===
    'STREAMING'
  ) {
    twitchLine =
      '\n🔗 **Twitch** · ' +
      (
        botInfo.streamingUrl ||
        'Non défini'
      );
  }

  const container =
    new ContainerBuilder()
      .setAccentColor(
        0x6b6de6
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            '# ⚙️ Edit Bot\n' +
            '🤖 **Nom** · ' +
            bot.user.username +
            '\n' +
            (
              STATUS_META[status]
                ?.emoji ||
              STATUS_META.online
                .emoji
            ) +
            ' **Statut** · ' +
            (
              STATUS_META[status]
                ?.label ||
              STATUS_META.online
                .label
            ) +
            '\n' +
            (
              ACTIVITY_META[
                activityType
              ]?.emoji ||
              ACTIVITY_META
                .LISTENING.emoji
            ) +
            ' **Activité** · ' +
            (
              ACTIVITY_META[
                activityType
              ]?.label ||
              ACTIVITY_META
                .LISTENING.label
            ) +
            twitchLine
          )
      )
      .addSeparatorComponents(
        separator()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            '1️⃣ **Texte 1** · ' +
            text1 +
            '\n' +
            '2️⃣ **Texte 2** · ' +
            text2
          )
      )
      .addSeparatorComponents(
        separator()
      );

  for (
    const row of
    buildMainButtons(
      botInfo
    )
  ) {
    container
      .addActionRowComponents(
        row
      );
  }

  return container;
}

function buildActivityContainer(
  botInfo
) {
  const current =
    getActivityTypeName(
      botInfo.activityType
    );

  const row =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'editbot_activity_PLAYING'
          )
          .setLabel('Playing')
          .setEmoji('🎮')
          .setStyle(
            current === 'PLAYING'
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_activity_STREAMING'
          )
          .setLabel('Streaming')
          .setEmoji('🟣')
          .setStyle(
            current === 'STREAMING'
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_activity_LISTENING'
          )
          .setLabel('Listening')
          .setEmoji('🎧')
          .setStyle(
            current === 'LISTENING'
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_activity_WATCHING'
          )
          .setLabel('Watching')
          .setEmoji('👀')
          .setStyle(
            current === 'WATCHING'
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          ),
        new ButtonBuilder()
          .setCustomId(
            'editbot_activity_COMPETING'
          )
          .setLabel('Competing')
          .setEmoji('🏆')
          .setStyle(
            current === 'COMPETING'
              ? ButtonStyle.Success
              : ButtonStyle.Secondary
          )
      );

  const backRow =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'editbot_back'
          )
          .setLabel('Retour')
          .setEmoji('↩️')
          .setStyle(
            ButtonStyle.Primary
          )
      );

  return new ContainerBuilder()
    .setAccentColor(
      0x6b6de6
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🎮 Type d’activité'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '**Actuel :** ' +
            getActivityDisplay(
              current
            ) +
            '\n\n' +
            '-# Streaming demande un lien Twitch.'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addActionRowComponents(
      row,
      backRow
    );
}

function buildStatusContainer(
  botInfo
) {
  const current =
    botInfo.status ||
    'online';

  const makeButton = (
    status,
    label,
    emoji
  ) =>
    new ButtonBuilder()
      .setCustomId(
        'editbot_status_' +
        status
      )
      .setLabel(label)
      .setEmoji(emoji)
      .setStyle(
        current === status
          ? ButtonStyle.Success
          : ButtonStyle.Secondary
      );

  const row =
    new ActionRowBuilder()
      .addComponents(
        makeButton(
          'online',
          'Online',
          '🟢'
        ),
        makeButton(
          'idle',
          'Idle',
          '🌙'
        ),
        makeButton(
          'dnd',
          'DND',
          '🔴'
        ),
        makeButton(
          'invisible',
          'Invisible',
          '⚫'
        )
      );

  const backRow =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            'editbot_back'
          )
          .setLabel('Retour')
          .setEmoji('↩️')
          .setStyle(
            ButtonStyle.Primary
          )
      );

  return new ContainerBuilder()
    .setAccentColor(
      0x6b6de6
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# 🟢 Statut du bot'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '**Actuel :** ' +
          getStatusDisplay(
            current
          )
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addActionRowComponents(
      row,
      backRow
    );
}

function buildClosedContainer() {
  return new ContainerBuilder()
    .setAccentColor(
      0x95a5a6
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# ⚙️ Configuration fermée'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          'Le panneau de modification du bot a été fermé.'
        )
    );
}

function buildExpiredContainer() {
  return new ContainerBuilder()
    .setAccentColor(
      0x95a5a6
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          '# ⌛ Configuration expirée'
        )
    )
    .addSeparatorComponents(
      separator()
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent(
          'Relancez **+editbot** pour modifier de nouveau le bot.'
        )
    );
}

function modalConfigFor(
  field,
  botInfo,
  bot
) {
  if (
    field === 'name'
  ) {
    return {
      title:
        'Modifier le nom',
      label:
        'Nouveau nom du bot',
      placeholder:
        bot.user.username,
      value:
        bot.user.username,
      maxLength: 32,
      style:
        TextInputStyle.Short
    };
  }

  if (
    field === 'text1'
  ) {
    return {
      title:
        'Modifier le Texte 1',
      label:
        'Texte d’activité 1',
      placeholder:
        '{prefix}help • {users} membres',
      value:
        botInfo.activityText ||
        '',
      maxLength: 128,
      style:
        TextInputStyle.Short
    };
  }

  if (
    field === 'text2'
  ) {
    return {
      title:
        'Modifier le Texte 2',
      label:
        'Texte d’activité 2',
      placeholder:
        '{prefix}help • {users} membres',
      value:
        botInfo.activityText2 ||
        '',
      maxLength: 128,
      style:
        TextInputStyle.Short
    };
  }

  if (
    field === 'avatar'
  ) {
    return {
      title:
        'Modifier l’avatar',
      label:
        'URL de la nouvelle image',
      placeholder:
        'https://...',
      value: '',
      maxLength: 1000,
      style:
        TextInputStyle.Short
    };
  }

  return null;
}

async function showValueModal({
  interaction,
  field,
  botInfo,
  bot
}) {
  const config =
    modalConfigFor(
      field,
      botInfo,
      bot
    );

  if (!config) {
    return null;
  }

  const modalId =
    'editbot_modal_' +
    field +
    '_' +
    interaction.id;

  const input =
    new TextInputBuilder()
      .setCustomId(
        'value'
      )
      .setLabel(
        config.label
      )
      .setStyle(
        config.style
      )
      .setRequired(true)
      .setMaxLength(
        config.maxLength
      );

  if (
    config.placeholder
  ) {
    input.setPlaceholder(
      config.placeholder
    );
  }

  if (config.value) {
    input.setValue(
      String(
        config.value
      ).slice(
        0,
        config.maxLength
      )
    );
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        modalId
      )
      .setTitle(
        config.title
      )
      .addComponents(
        new ActionRowBuilder()
          .addComponents(
            input
          )
      );

  await interaction
    .showModal(modal);

  return interaction
    .awaitModalSubmit({
      filter:
        modalInteraction =>
          modalInteraction
            .customId ===
            modalId &&
          modalInteraction
            .user.id ===
            interaction.user.id,
      time: 60000
    })
    .catch(() => null);
}

async function showStreamingModal({
  interaction,
  botInfo
}) {
  const modalId =
    'editbot_streaming_' +
    interaction.id;

  const input =
    new TextInputBuilder()
      .setCustomId(
        'twitch_url'
      )
      .setLabel(
        'Lien Twitch'
      )
      .setPlaceholder(
        'https://www.twitch.tv/votrechaine'
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(200);

  if (
    botInfo.streamingUrl
  ) {
    input.setValue(
      String(
        botInfo.streamingUrl
      ).slice(0, 200)
    );
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        modalId
      )
      .setTitle(
        'Configurer le Streaming'
      )
      .addComponents(
        new ActionRowBuilder()
          .addComponents(
            input
          )
      );

  await interaction
    .showModal(modal);

  return interaction
    .awaitModalSubmit({
      filter:
        modalInteraction =>
          modalInteraction
            .customId ===
            modalId &&
          modalInteraction
            .user.id ===
            interaction.user.id,
      time: 60000
    })
    .catch(() => null);
}

async function applyValueChange(
  bot,
  botInfo,
  field,
  value
) {
  const cleanValue =
    String(value || '')
      .trim();

  if (!cleanValue) {
    throw new Error(
      'EMPTY_VALUE'
    );
  }

  if (
    field === 'name'
  ) {
    const clientToken =
      bot.token ||
      process.env.TOKEN;

    let changeError = null;

    try {
      await bot.user
        .setUsername(
          cleanValue
        );
    } catch (error) {
      changeError = error;
    } finally {
      restoreClientToken(
        bot,
        clientToken
      );
    }

    if (changeError) {
      throw changeError;
    }

    botInfo.botName =
      bot.user.username;
  }

  if (
    field === 'text1'
  ) {
    botInfo.activityText =
      normalizeActivityTemplate(
        cleanValue
      );
  }

  if (
    field === 'text2'
  ) {
    botInfo.activityText2 =
      normalizeActivityTemplate(
        cleanValue
      );
  }

  if (
    field === 'avatar'
  ) {
    const clientToken =
      bot.token ||
      process.env.TOKEN;

    let changeError = null;

    try {
      await bot.user
        .setAvatar(
          cleanValue
        );
    } catch (error) {
      changeError = error;
    } finally {
      restoreClientToken(
        bot,
        clientToken
      );
    }

    if (changeError) {
      throw changeError;
    }
  }

  await botInfo.save();

  if (
    field === 'text1' ||
    field === 'text2'
  ) {
    buildRuntimeActivity(
      bot,
      botInfo
    );
  }
}

async function applyActivityType(
  bot,
  botInfo,
  key,
  streamingUrl = null
) {
  if (
    ACTIVITY_TYPES[key] ===
    undefined
  ) {
    throw new Error(
      'INVALID_ACTIVITY_TYPE'
    );
  }

  if (
    key === 'STREAMING'
  ) {
    botInfo.streamingUrl =
      normalizeTwitchUrl(
        streamingUrl
      );
  }

  botInfo.activityType =
    key;

  await botInfo.save();

  buildRuntimeActivity(
    bot,
    botInfo
  );
}

async function applyStatus(
  bot,
  botInfo,
  status
) {
  if (
    !VALID_STATUSES.includes(
      status
    )
  ) {
    throw new Error(
      'INVALID_STATUS'
    );
  }

  botInfo.status =
    status;

  await botInfo.save();

  bot.user.setStatus(
    status
  );
}

function getErrorText(
  error
) {
  if (
    error?.message ===
    'EMPTY_VALUE'
  ) {
    return 'La valeur ne peut pas être vide.';
  }

  if (
    error?.message ===
    'INVALID_TWITCH_URL'
  ) {
    return (
      'Lien Twitch invalide. Utilisez par exemple : ' +
      '**https://www.twitch.tv/votrechaine**'
    );
  }

  if (
    error?.message ===
    'INVALID_ACTIVITY_TYPE'
  ) {
    return 'Ce type d’activité est invalide.';
  }

  if (
    error?.message ===
    'INVALID_STATUS'
  ) {
    return 'Ce statut est invalide.';
  }

  return 'Impossible d’appliquer cette modification.';
}

module.exports = {
  name: 'editbot',
  description:
    'Modifier les informations du bot avec une interface Component V2.',

  async execute(message) {
    if (!message.guild) {
      return;
    }

    if (
      !(await isBotOwner(
        message.author.id
      ))
    ) {
      return;
    }

    if (
      mongoose.connection
        .readyState !== 1
    ) {
      return message.reply(
        replyEmbedPayload(
          'La connexion à la base de données n’est pas établie.',
          {
            type: 'error'
          }
        )
      );
    }

    try {
      let botInfo =
        await BotInfo.findOne({
          guildId:
            message.guild.id
        });

      if (!botInfo) {
        botInfo =
          await BotInfo.create({
            guildId:
              message.guild.id,
            botName:
              message.client
                .user.username,
            activityType:
              'LISTENING',
            activityText:
              currentActivityText(
                message.client
              ),
            activityText2:
              DEFAULT_DYNAMIC_ACTIVITY,
            streamingUrl: '',
            status:
              message.client
                .user.presence
                ?.status ||
              'online'
          });
      }

      let shouldSave =
        false;

      if (
        botInfo.botName !==
        message.client
          .user.username
      ) {
        botInfo.botName =
          message.client
            .user.username;
        shouldSave = true;
      }

      const normalizedText1 =
        normalizeActivityTemplate(
          botInfo.activityText
        );

      const normalizedText2 =
        normalizeActivityTemplate(
          botInfo.activityText2
        );

      if (
        normalizedText1 !==
        botInfo.activityText
      ) {
        botInfo.activityText =
          normalizedText1;
        shouldSave = true;
      }

      if (
        normalizedText2 !==
        botInfo.activityText2
      ) {
        botInfo.activityText2 =
          normalizedText2;
        shouldSave = true;
      }

      if (shouldSave) {
        await botInfo.save();
      }

      const panel =
        await message.reply({
          flags:
            MessageFlags
              .IsComponentsV2,
          components: [
            buildMainContainer(
              botInfo,
              message.client
            )
          ]
        });

      const collector =
        panel
          .createMessageComponentCollector({
            time: 5 * 60 * 1000
          });

      const refreshMain =
        async () => {
          botInfo =
            await BotInfo.findOne({
              guildId:
                message.guild.id
            });

          if (!botInfo) {
            return;
          }

          await panel.edit({
            components: [
              buildMainContainer(
                botInfo,
                message.client
              )
            ]
          });
        };

      collector.on(
        'collect',
        async interaction => {
          if (
            !interaction.customId
              .startsWith(
                'editbot_'
              )
          ) {
            return;
          }

          if (
            interaction.user.id !==
            message.author.id
          ) {
            return interaction
              .reply({
                ...replyEmbedPayload(
                  'Ce panneau ne vous appartient pas.',
                  {
                    type: 'error'
                  }
                ),
                flags:
                  MessageFlags
                    .Ephemeral
              })
              .catch(() => {});
          }

          try {
            if (
              interaction.customId ===
              'editbot_close'
            ) {
              await interaction
                .update({
                  components: [
                    buildClosedContainer()
                  ]
                });

              collector.stop(
                'closed'
              );

              return;
            }

            if (
              interaction.customId ===
              'editbot_back'
            ) {
              await interaction
                .update({
                  components: [
                    buildMainContainer(
                      botInfo,
                      message.client
                    )
                  ]
                });

              return;
            }

            if (
              interaction.customId ===
              'editbot_activity'
            ) {
              await interaction
                .update({
                  components: [
                    buildActivityContainer(
                      botInfo
                    )
                  ]
                });

              return;
            }

            if (
              interaction.customId ===
              'editbot_status'
            ) {
              await interaction
                .update({
                  components: [
                    buildStatusContainer(
                      botInfo
                    )
                  ]
                });

              return;
            }

            if (
              interaction.customId
                .startsWith(
                  'editbot_status_'
                )
            ) {
              const status =
                interaction.customId
                  .replace(
                    'editbot_status_',
                    ''
                  );

              await interaction
                .deferUpdate();

              await applyStatus(
                message.client,
                botInfo,
                status
              );

              await refreshMain();
              return;
            }

            if (
              interaction.customId
                .startsWith(
                  'editbot_activity_'
                )
            ) {
              const type =
                interaction.customId
                  .replace(
                    'editbot_activity_',
                    ''
                  );

              if (
                type ===
                'STREAMING'
              ) {
                const modalInteraction =
                  await showStreamingModal({
                    interaction,
                    botInfo
                  });

                if (
                  !modalInteraction
                ) {
                  return;
                }

                await modalInteraction
                  .deferUpdate();

                const twitchUrl =
                  modalInteraction
                    .fields
                    .getTextInputValue(
                      'twitch_url'
                    );

                await applyActivityType(
                  message.client,
                  botInfo,
                  'STREAMING',
                  twitchUrl
                );

                await refreshMain();
                return;
              }

              await interaction
                .deferUpdate();

              await applyActivityType(
                message.client,
                botInfo,
                type
              );

              await refreshMain();
              return;
            }

            const fieldMap = {
              editbot_name:
                'name',
              editbot_text1:
                'text1',
              editbot_text2:
                'text2',
              editbot_avatar:
                'avatar'
            };

            const field =
              fieldMap[
                interaction.customId
              ];

            if (!field) {
              return interaction
                .deferUpdate()
                .catch(() => {});
            }

            const modalInteraction =
              await showValueModal({
                interaction,
                field,
                botInfo,
                bot:
                  message.client
              });

            if (
              !modalInteraction
            ) {
              return;
            }

            await modalInteraction
              .deferUpdate();

            const value =
              modalInteraction
                .fields
                .getTextInputValue(
                  'value'
                );

            await applyValueChange(
              message.client,
              botInfo,
              field,
              value
            );

            await refreshMain();
          } catch (error) {
            console.error(
              'Erreur +editbot :',
              error
            );

            const errorText =
              getErrorText(
                error
              );

            if (
              interaction.deferred ||
              interaction.replied
            ) {
              await interaction
                .followUp({
                  ...replyEmbedPayload(
                    errorText,
                    {
                      type: 'error',
                      title:
                        '❌ Modification impossible'
                    }
                  ),
                  flags:
                    MessageFlags
                      .Ephemeral
                })
                .catch(() => {});

              return;
            }

            await interaction
              .reply({
                ...replyEmbedPayload(
                  errorText,
                  {
                    type: 'error',
                    title:
                      '❌ Modification impossible'
                  }
                ),
                flags:
                  MessageFlags
                    .Ephemeral
              })
              .catch(() => {});
          }
        }
      );

      collector.on(
        'end',
        async (
          _collected,
          reason
        ) => {
          if (
            reason === 'closed'
          ) {
            return;
          }

          await panel.edit({
            components: [
              buildExpiredContainer()
            ]
          }).catch(() => {});
        }
      );

      return panel;
    } catch (error) {
      console.error(
        'Erreur +editbot :',
        error
      );

      return message.reply(
        replyEmbedPayload(
          'Une erreur s’est produite lors de la modification des informations du bot.',
          {
            type: 'error'
          }
        )
      );
    }
  }
};
