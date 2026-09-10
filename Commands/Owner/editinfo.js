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

const ACTIVITY_TEXTS_PER_PAGE = 4;

function getActivityTexts(botInfo) {
  const stored =
    Array.isArray(
      botInfo?.activityTexts
    )
      ? botInfo.activityTexts
          .map(
            normalizeActivityTemplate
          )
          .filter(Boolean)
      : [];

  if (stored.length) {
    return stored;
  }

  return [
    botInfo?.activityText,
    botInfo?.activityText2
  ]
    .map(
      normalizeActivityTemplate
    )
    .filter(Boolean);
}

function syncLegacyActivityTexts(
  botInfo,
  texts
) {
  botInfo.activityTexts =
    texts;

  botInfo.activityText =
    texts[0] || '';

  botInfo.activityText2 =
    texts[1] || '';
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
  const texts =
    getActivityTexts(
      botInfo
    );

  const type =
    resolveActivityType(
      botInfo.activityType
    );

  bot.activityRotation = {
    texts,
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

function buildGlobalButtons(botInfo) {
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

  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'editbot_name'
        )
        .setLabel('Nom')
        .setEmoji('✏️')
        .setStyle(
          ButtonStyle.Primary
        ),
      new ButtonBuilder()
        .setCustomId(
          'editbot_avatar'
        )
        .setLabel(
          'Photo de profil'
        )
        .setEmoji('🖼️')
        .setStyle(
          ButtonStyle.Primary
        ),
      new ButtonBuilder()
        .setCustomId(
          'editbot_banner'
        )
        .setLabel('Bannière')
        .setEmoji('🌌')
        .setStyle(
          ButtonStyle.Primary
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
          ButtonStyle.Primary
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
          ButtonStyle.Primary
        )
    );
}

function buildActivityTextControls(
  botInfo,
  page = 0
) {
  const texts =
    getActivityTexts(
      botInfo
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        texts.length /
        ACTIVITY_TEXTS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      Math.max(
        0,
        page
      ),
      totalPages - 1
    );

  const start =
    safePage *
    ACTIVITY_TEXTS_PER_PAGE;

  const visible =
    texts.slice(
      start,
      start +
        ACTIVITY_TEXTS_PER_PAGE
    );

  const editRow =
    new ActionRowBuilder();

  visible.forEach(
    (_text, offset) => {
      const index =
        start + offset;

      editRow.addComponents(
        new ButtonBuilder()
          .setCustomId(
            'editbot_text_' +
            index
          )
          .setLabel(
            'Texte ' +
            (index + 1)
          )
          .setEmoji('📝')
          .setStyle(
            ButtonStyle.Secondary
          )
      );
    }
  );

  editRow.addComponents(
    new ButtonBuilder()
      .setCustomId(
        'editbot_text_add'
      )
      .setLabel('Ajouter')
      .setEmoji('➕')
      .setStyle(
        ButtonStyle.Success
      )
  );

  const rows = [
    editRow
  ];

  if (
    totalPages > 1
  ) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              'editbot_text_prev'
            )
            .setEmoji('◀️')
            .setStyle(
              ButtonStyle.Secondary
            )
            .setDisabled(
              safePage === 0
            ),
          new ButtonBuilder()
            .setCustomId(
              'editbot_text_page'
            )
            .setLabel(
              'Page ' +
              (safePage + 1) +
              '/' +
              totalPages
            )
            .setStyle(
              ButtonStyle.Secondary
            )
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(
              'editbot_text_next'
            )
            .setEmoji('▶️')
            .setStyle(
              ButtonStyle.Secondary
            )
            .setDisabled(
              safePage >=
              totalPages - 1
            )
        )
    );
  }

  return rows;
}

function buildCloseButton() {
  return new ActionRowBuilder()
    .addComponents(
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
}

function buildMainContainer(
  botInfo,
  bot,
  textPage = 0
) {
  const prefix =
    process.env.PREFIX ||
    '+';

  const activityType =
    getActivityTypeName(
      botInfo.activityType
    );

  const activityMeta =
    ACTIVITY_META[
      activityType
    ] ||
    ACTIVITY_META.LISTENING;

  const status =
    botInfo.status ||
    bot.user.presence
      ?.status ||
    'online';

  const statusMeta =
    STATUS_META[status] ||
    STATUS_META.online;

  const texts =
    getActivityTexts(
      botInfo
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        texts.length /
        ACTIVITY_TEXTS_PER_PAGE
      )
    );

  const safePage =
    Math.min(
      Math.max(
        0,
        textPage
      ),
      totalPages - 1
    );

  const start =
    safePage *
    ACTIVITY_TEXTS_PER_PAGE;

  const visibleTexts =
    texts
      .slice(
        start,
        start +
          ACTIVITY_TEXTS_PER_PAGE
      )
      .map(
        (text, offset) =>
          '• **Texte ' +
          (start + offset + 1) +
          '** · ' +
          renderActivityText(
            text,
            bot,
            prefix
          )
      );

  const textLines =
    visibleTexts.length
      ? visibleTexts.join(
          '\n'
        )
      : 'Aucun texte configuré.';

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
            '# Paramètres du bot'
          )
      )
      .addSeparatorComponents(
        separator()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            '🤖 **Nom** · ' +
            bot.user.username +
            '\n' +
            statusMeta.emoji +
            ' **Statut** · ' +
            statusMeta.label +
            '\n' +
            activityMeta.emoji +
            ' **Activité** · ' +
            activityMeta.label +
            twitchLine
          )
      )
      .addActionRowComponents(
        buildGlobalButtons(
          botInfo
        )
      )
      .addSeparatorComponents(
        separator()
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(
            '## Activité du bot\n\n' +
            textLines +
            '\n\n' +
            '-# Variables dynamiques : `{prefix}` et `{users}`'
          )
      );

  for (
    const row of
    buildActivityTextControls(
      botInfo,
      safePage
    )
  ) {
    container
      .addActionRowComponents(
        row
      );
  }

  return container
    .addSeparatorComponents(
      separator()
    )
    .addActionRowComponents(
      buildCloseButton()
    );
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

  if (
    field === 'banner'
  ) {
    return {
      title:
        'Modifier la bannière',
      label:
        'URL de la bannière',
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

async function showActivityTextModal({
  interaction,
  index,
  botInfo
}) {
  const texts =
    getActivityTexts(
      botInfo
    );

  const isNew =
    index === null;

  const current =
    isNew
      ? ''
      : texts[index] || '';

  const modalId =
    'editbot_activity_text_' +
    (
      isNew
        ? 'add'
        : index
    ) +
    '_' +
    interaction.id;

  const input =
    new TextInputBuilder()
      .setCustomId(
        'activity_text'
      )
      .setLabel(
        isNew
          ? 'Nouveau texte'
          : 'Modifier le texte ' +
            (index + 1)
      )
      .setPlaceholder(
        '{prefix}help • {users} users'
      )
      .setStyle(
        TextInputStyle.Short
      )
      .setRequired(true)
      .setMaxLength(128);

  if (current) {
    input.setValue(
      current.slice(
        0,
        128
      )
    );
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        modalId
      )
      .setTitle(
        isNew
          ? 'Ajouter une activité'
          : 'Modifier une activité'
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

async function applyActivityTextChange(
  bot,
  botInfo,
  index,
  value
) {
  const cleanValue =
    normalizeActivityTemplate(
      value
    );

  if (!cleanValue) {
    throw new Error(
      'EMPTY_VALUE'
    );
  }

  const texts =
    getActivityTexts(
      botInfo
    );

  if (
    index === null
  ) {
    texts.push(
      cleanValue
    );
  } else {
    if (
      index < 0 ||
      index >= texts.length
    ) {
      throw new Error(
        'INVALID_ACTIVITY_TEXT'
      );
    }

    texts[index] =
      cleanValue;
  }

  syncLegacyActivityTexts(
    botInfo,
    texts
  );

  await botInfo.save();

  buildRuntimeActivity(
    bot,
    botInfo
  );

  return texts.length;
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

  if (
    field === 'banner'
  ) {
    const clientToken =
      bot.token ||
      process.env.TOKEN;

    let changeError = null;

    try {
      await bot.user
        .setBanner(
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

  if (
    error?.message ===
    'INVALID_ACTIVITY_TEXT'
  ) {
    return 'Ce texte d’activité n’existe plus.';
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
            activityTexts: [
              currentActivityText(
                message.client
              ),
              DEFAULT_DYNAMIC_ACTIVITY
            ],
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

      let activityTexts =
        getActivityTexts(
          botInfo
        )
          .map(
            normalizeActivityTemplate
          )
          .filter(Boolean);

      if (
        !activityTexts.length
      ) {
        activityTexts = [
          currentActivityText(
            message.client
          ),
          DEFAULT_DYNAMIC_ACTIVITY
        ];
      }

      const storedTexts =
        Array.isArray(
          botInfo.activityTexts
        )
          ? botInfo.activityTexts
              .map(
                normalizeActivityTemplate
              )
              .filter(Boolean)
          : [];

      if (
        JSON.stringify(
          storedTexts
        ) !==
        JSON.stringify(
          activityTexts
        )
      ) {
        syncLegacyActivityTexts(
          botInfo,
          activityTexts
        );

        shouldSave = true;
      }

      if (shouldSave) {
        await botInfo.save();
      }

      let textPage = 0;

      const panel =
        await message.reply({
          flags:
            MessageFlags
              .IsComponentsV2,
          components: [
            buildMainContainer(
              botInfo,
              message.client,
              textPage
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

          const textCount =
            getActivityTexts(
              botInfo
            ).length;

          const pageCount =
            Math.max(
              1,
              Math.ceil(
                textCount /
                ACTIVITY_TEXTS_PER_PAGE
              )
            );

          textPage =
            Math.min(
              textPage,
              pageCount - 1
            );

          await panel.edit({
            components: [
              buildMainContainer(
                botInfo,
                message.client,
                textPage
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
                      message.client,
                      textPage
                    )
                  ]
                });

              return;
            }

            if (
              interaction.customId ===
              'editbot_text_prev' ||
              interaction.customId ===
              'editbot_text_next'
            ) {
              if (
                interaction.customId ===
                'editbot_text_prev'
              ) {
                textPage =
                  Math.max(
                    0,
                    textPage - 1
                  );
              } else {
                const pageCount =
                  Math.max(
                    1,
                    Math.ceil(
                      getActivityTexts(
                        botInfo
                      ).length /
                      ACTIVITY_TEXTS_PER_PAGE
                    )
                  );

                textPage =
                  Math.min(
                    pageCount - 1,
                    textPage + 1
                  );
              }

              await interaction
                .update({
                  components: [
                    buildMainContainer(
                      botInfo,
                      message.client,
                      textPage
                    )
                  ]
                });

              return;
            }

            if (
              interaction.customId ===
              'editbot_text_page'
            ) {
              return interaction
                .deferUpdate()
                .catch(() => {});
            }

            if (
              interaction.customId ===
                'editbot_text_add' ||
              /^editbot_text_\d+$/.test(
                interaction.customId
              )
            ) {
              const isNew =
                interaction.customId ===
                'editbot_text_add';

              const index =
                isNew
                  ? null
                  : Number(
                      interaction.customId
                        .replace(
                          'editbot_text_',
                          ''
                        )
                    );

              const modalInteraction =
                await showActivityTextModal({
                  interaction,
                  index,
                  botInfo
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
                    'activity_text'
                  );

              const textCount =
                await applyActivityTextChange(
                  message.client,
                  botInfo,
                  index,
                  value
                );

              if (isNew) {
                textPage =
                  Math.floor(
                    (textCount - 1) /
                    ACTIVITY_TEXTS_PER_PAGE
                  );
              }

              await refreshMain();
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
              editbot_avatar:
                'avatar',
              editbot_banner:
                'banner'
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
