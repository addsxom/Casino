const {
  ActivityType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');

const mongoose = require('mongoose');
const { replyEmbedPayload } = require('../../utils/replyEmbed.js');
const BotInfo = require('../../Models/BotInfo');
const Owner = require('../../Models/Owner.js');
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

const VALID_STATUSES = ['online', 'idle', 'dnd', 'invisible'];

async function isBotOwner(userId) {
  if (userId === process.env.BUYER) return true;
  return Boolean(await Owner.exists({ userId }));
}

function restoreClientToken(client, token) {
  if (!token) return;
  client.token = token;
  client.rest.setToken(token);
}

function resolveActivityType(value) {
  if (typeof value === 'number') return value;

  const key = String(value || 'LISTENING').toUpperCase();
  return ACTIVITY_TYPES[key] ?? ActivityType.Listening;
}

function getActivityTypeName(value) {
  if (typeof value === 'string') {
    const key = value.toUpperCase();
    if (ACTIVITY_TYPES[key] !== undefined) return key;
  }

  const entry = Object.entries(ACTIVITY_TYPES)
    .find(([, type]) => type === value);

  return entry?.[0] || 'LISTENING';
}

function currentActivityText(bot) {
  return bot.user.presence?.activities?.[0]?.name || bot.user.username;
}

function buildRuntimeActivity(bot, botInfo) {
  const text1 = normalizeActivityTemplate(
    botInfo.activityText
  );
  const text2 = normalizeActivityTemplate(
    botInfo.activityText2
  );

  bot.activityRotation = {
    texts: [text1, text2].filter(Boolean),
    type: resolveActivityType(botInfo.activityType),
    index: 0
  };

  const firstText = bot.activityRotation.texts[0];

  if (firstText) {
    bot.user.setActivity(
      renderActivityText(
        firstText,
        bot,
        process.env.PREFIX || '+'
      ),
      {
        type: bot.activityRotation.type
      }
    );
  }
}

function createInfoEmbed(botInfo, bot) {
  const prefix = process.env.PREFIX || '+';
  const text1 = botInfo.activityText
    ? renderActivityText(botInfo.activityText, bot, prefix)
    : 'Non défini';
  const text2 = botInfo.activityText2
    ? renderActivityText(botInfo.activityText2, bot, prefix)
    : 'Non défini';
  const activityType = getActivityTypeName(botInfo.activityType);
  const status = botInfo.status || bot.user.presence?.status || 'online';

  return new EmbedBuilder()
    .setTitle(`Informations de ${bot.user.username}`)
    .setThumbnail(bot.user.displayAvatarURL({ dynamic: true }))
    .setColor(0x6b6de6)
    .addFields(
      {
        name: 'Nom du bot',
        value: `\`${bot.user.username}\``,
        inline: false
      },
      {
        name: 'Type d’activité',
        value: `\`${activityType}\``,
        inline: true
      },
      {
        name: 'Statut',
        value: `\`${status}\``,
        inline: true
      },
      {
        name: 'Texte 1',
        value: `\`${text1}\``,
        inline: false
      },
      {
        name: 'Texte 2',
        value: `\`${text2}\``,
        inline: false
      }
    )
    .setFooter({
      text: `${bot.user.username} • Configuration`,
      iconURL: bot.user.displayAvatarURL({ dynamic: true })
    });
}

function buildMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('editInfo')
      .setPlaceholder('Choisissez ce que vous voulez modifier')
      .addOptions(
        {
          label: 'Nom du bot',
          value: 'botName',
          description: 'Modifier le nom actuel du bot'
        },
        {
          label: 'Type d’activité',
          value: 'activityType',
          description: 'Playing, Listening, Watching...'
        },
        {
          label: 'Texte 1',
          value: 'activityText',
          description: 'Modifier le premier texte d’activité'
        },
        {
          label: 'Texte 2',
          value: 'activityText2',
          description: 'Modifier le second texte d’activité'
        },
        {
          label: 'Avatar',
          value: 'avatar',
          description: 'Modifier la photo de profil du bot'
        },
        {
          label: 'Statut',
          value: 'status',
          description: 'online, idle, dnd ou invisible'
        }
      )
  );
}

function promptFor(field) {
  switch (field) {
    case 'botName':
      return 'Envoie le nouveau **nom du bot**.';
    case 'activityType':
      return 'Envoie le nouveau **type d’activité** : `PLAYING`, `STREAMING`, `LISTENING`, `WATCHING` ou `COMPETING`.';
    case 'activityText':
      return (
        'Envoie le nouveau **Texte 1**.\n' +
        '-# Variables disponibles : `{prefix}` et `{users}`'
      );
    case 'activityText2':
      return (
        'Envoie le nouveau **Texte 2**.\n' +
        '-# Variables disponibles : `{prefix}` et `{users}`'
      );
    case 'avatar':
      return 'Envoie la nouvelle **URL de l’avatar**.';
    case 'status':
      return 'Envoie le nouveau **statut** : `online`, `idle`, `dnd` ou `invisible`.';
    default:
      return 'Envoie la nouvelle valeur.';
  }
}

async function applyChange(bot, botInfo, field, value) {
  const cleanValue = String(value || '').trim();

  if (!cleanValue) {
    throw new Error('EMPTY_VALUE');
  }

  if (field === 'botName') {
    const clientToken = bot.token || process.env.TOKEN;
    let changeError = null;

    try {
      await bot.user.setUsername(cleanValue);
    } catch (error) {
      changeError = error;
    } finally {
      restoreClientToken(bot, clientToken);
    }

    if (changeError) throw changeError;

    botInfo.botName = bot.user.username;
  }

  if (field === 'activityType') {
    const key = cleanValue.toUpperCase();

    if (ACTIVITY_TYPES[key] === undefined) {
      throw new Error('INVALID_ACTIVITY_TYPE');
    }

    botInfo.activityType = key;
  }

  if (field === 'activityText') {
    botInfo.activityText =
      normalizeActivityTemplate(cleanValue);
  }

  if (field === 'activityText2') {
    botInfo.activityText2 =
      normalizeActivityTemplate(cleanValue);
  }

  if (field === 'avatar') {
    const clientToken = bot.token || process.env.TOKEN;
    let changeError = null;

    try {
      await bot.user.setAvatar(cleanValue);
    } catch (error) {
      changeError = error;
    } finally {
      restoreClientToken(bot, clientToken);
    }

    if (changeError) throw changeError;
  }

  if (field === 'status') {
    const status = cleanValue.toLowerCase();

    if (!VALID_STATUSES.includes(status)) {
      throw new Error('INVALID_STATUS');
    }

    botInfo.status = status;
    bot.user.setStatus(status);
  }

  await botInfo.save();

  if (
    field === 'activityType' ||
    field === 'activityText' ||
    field === 'activityText2'
  ) {
    buildRuntimeActivity(bot, botInfo);
  }
}

module.exports = {
  name: 'editbot',
  description: 'Modifier les informations du bot.',

  async execute(message) {
    if (!message.guild) return;

    if (!(await isBotOwner(message.author.id))) {
      return;
    }

    if (mongoose.connection.readyState !== 1) {
      return message.reply(
        replyEmbedPayload(
          'La connexion à la base de données n’est pas établie.',
          { type: 'error' }
        )
      );
    }

    try {
      let botInfo = await BotInfo.findOne({
        guildId: message.guild.id
      });

      if (!botInfo) {
        botInfo = await BotInfo.create({
          guildId: message.guild.id,
          botName: message.client.user.username,
          activityType: 'LISTENING',
          activityText: currentActivityText(message.client),
          activityText2: DEFAULT_DYNAMIC_ACTIVITY,
          status: message.client.user.presence?.status || 'online'
        });
      }

      let shouldSave = false;

      if (botInfo.botName !== message.client.user.username) {
        botInfo.botName = message.client.user.username;
        shouldSave = true;
      }

      const normalizedText1 =
        normalizeActivityTemplate(botInfo.activityText);
      const normalizedText2 =
        normalizeActivityTemplate(botInfo.activityText2);

      if (normalizedText1 !== botInfo.activityText) {
        botInfo.activityText = normalizedText1;
        shouldSave = true;
      }

      if (normalizedText2 !== botInfo.activityText2) {
        botInfo.activityText2 = normalizedText2;
        shouldSave = true;
      }

      if (shouldSave) {
        await botInfo.save();
      }

      const panel = await message.reply({
        embeds: [createInfoEmbed(botInfo, message.client)],
        components: [buildMenu()]
      });

      const collector = panel.createMessageComponentCollector({
        filter: interaction =>
          interaction.customId === 'editInfo' &&
          interaction.user.id === message.author.id,
        time: 300000
      });

      collector.on('collect', async interaction => {
        await interaction.deferUpdate();

        const field = interaction.values[0];

        const question = await message.channel.send(
          replyEmbedPayload(
            promptFor(field),
            {
              type: 'info',
              title: '✏️ Modification du bot'
            }
          )
        );

        const collected = await message.channel.awaitMessages({
          filter: response =>
            response.author.id === message.author.id,
          max: 1,
          time: 60000
        });

        const response = collected.first();

        if (!response) {
          return question.edit(
            replyEmbedPayload(
              'Temps écoulé. Relance la sélection dans le menu.',
              {
                type: 'warning',
                title: '⌛ Temps écoulé'
              }
            )
          );
        }

        const value = response.content;

        await response.delete().catch(() => {});
        await question.delete().catch(() => {});

        try {
          await applyChange(
            message.client,
            botInfo,
            field,
            value
          );

          botInfo = await BotInfo.findOne({
            guildId: message.guild.id
          });

          await panel.edit({
            embeds: [createInfoEmbed(botInfo, message.client)],
            components: [buildMenu()]
          });
        } catch (error) {
          let errorText = '❌・Impossible d’appliquer cette modification.';

          if (error.message === 'INVALID_ACTIVITY_TYPE') {
            errorText =
              '❌・Type invalide. Utilise PLAYING, STREAMING, LISTENING, WATCHING ou COMPETING.';
          } else if (error.message === 'INVALID_STATUS') {
            errorText =
              '❌・Statut invalide. Utilise online, idle, dnd ou invisible.';
          } else if (error.message === 'EMPTY_VALUE') {
            errorText = '❌・La valeur ne peut pas être vide.';
          } else {
            console.error('Erreur +editbot :', error);
          }

          const errorMessage = await message.channel.send(
            replyEmbedPayload(
              errorText.replace(/^❌・/, ''),
              { type: 'error' }
            )
          );

          setTimeout(() => {
            errorMessage.delete().catch(() => {});
          }, 5000);
        }
      });

      collector.on('end', async () => {
        await panel.edit({
          components: []
        }).catch(() => {});
      });
    } catch (error) {
      console.error('Erreur +editbot :', error);

      return message.reply(
        replyEmbedPayload(
          'Une erreur s’est produite lors de la modification des informations du bot.',
          { type: 'error' }
        )
      );
    }
  }
};
