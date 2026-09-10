const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const Owner = require('../../Models/Owner.js');
const { replyEmbedPayload } = require('../../utils/replyEmbed.js');
const {
  sendStaffLog,
  buildDiscordLog
} = require('../../utils/staffLogs.js');

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const BULK_DELETE_MARGIN = 60 * 1000;

async function isBotOwner(userId) {
  if (userId === process.env.BUYER) return true;

  return Boolean(
    await Owner.exists({ userId })
  );
}

async function deleteBatch(channel, messages) {
  let deleted = 0;

  const now = Date.now();

  const recentMessages = messages.filter(
    msg =>
      now - msg.createdTimestamp <
      FOURTEEN_DAYS - BULK_DELETE_MARGIN
  );

  const oldMessages = messages.filter(
    msg => !recentMessages.has(msg.id)
  );

  if (recentMessages.size > 0) {
    const result = await channel.bulkDelete(
      recentMessages,
      true
    );

    deleted += result.size;
  }

  // bulkDelete ne peut pas supprimer les messages de plus de 14 jours.
  // Ceux-ci sont donc supprimés un par un.
  for (const oldMessage of oldMessages.values()) {
    try {
      await oldMessage.delete();
      deleted++;
    } catch (error) {
      console.error(
        `Impossible de supprimer le message ${oldMessage.id} :`,
        error?.code || error?.message || error
      );
    }
  }

  return deleted;
}

async function clearMessages(channel, requestedAmount = null) {
  let deleted = 0;
  let before;

  while (
    requestedAmount === null ||
    deleted < requestedAmount
  ) {
    const remaining =
      requestedAmount === null
        ? 100
        : Math.min(100, requestedAmount - deleted);

    if (remaining <= 0) break;

    const fetched = await channel.messages.fetch({
      limit: remaining,
      ...(before ? { before } : {})
    });

    if (!fetched.size) break;

    const oldest = fetched.last();
    before = oldest?.id;

    deleted += await deleteBatch(
      channel,
      fetched
    );

    if (fetched.size < remaining) break;

    // Évite de tourner en boucle si Discord ne renvoie plus de page suivante.
    if (!before) break;
  }

  return deleted;
}


async function clearCategory(message, categoryId) {
  const category =
    message.guild.channels.cache.get(
      categoryId
    ) ||
    await message.guild.channels
      .fetch(categoryId)
      .catch(() => null);

  if (
    !category ||
    category.type !==
      ChannelType.GuildCategory
  ) {
    return {
      ok: false,
      reason: 'invalid_category'
    };
  }

  const channels =
    message.guild.channels.cache
      .filter(channel =>
        channel.parentId ===
          category.id &&
        channel.isTextBased?.() ===
          true &&
        Boolean(channel.messages)
      )
      .sort((a, b) =>
        (a.rawPosition || 0) -
        (b.rawPosition || 0)
      );

  let deleted = 0;
  let clearedChannels = 0;
  const failedChannels = [];

  for (const channel of channels.values()) {
    try {
      const channelDeleted =
        await clearMessages(
          channel,
          null
        );

      deleted += channelDeleted;
      clearedChannels++;
    } catch (error) {
      console.error(
        `Erreur +clearctg dans ${channel.id} :`,
        error?.code ||
          error?.message ||
          error
      );

      failedChannels.push(
        channel
      );
    }
  }

  return {
    ok: true,
    category,
    totalChannels: channels.size,
    clearedChannels,
    deleted,
    failedChannels
  };
}

function buildCategoryConfirmationRow(
  disabled = false
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'clearctg_confirm'
        )
        .setLabel('Confirmer')
        .setEmoji('✅')
        .setStyle(
          ButtonStyle.Danger
        )
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(
          'clearctg_cancel'
        )
        .setLabel('Annuler')
        .setEmoji('✖️')
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(disabled)
    );
}

async function confirmCategoryClear(
  message,
  category
) {
  const textChannels =
    message.guild.channels.cache
      .filter(channel =>
        channel.parentId ===
          category.id &&
        channel.isTextBased?.() ===
          true &&
        Boolean(channel.messages)
      );

  const confirmation =
    await message.reply({
      ...replyEmbedPayload(
        `Tu vas supprimer **tous les messages** de **${textChannels.size} salon${textChannels.size > 1 ? 's' : ''}** dans la catégorie **${category.name}**.\n\n` +
        '⚠️ Cette action est irréversible.',
        {
          type: 'warning',
          title: '🧹 Confirmer le clear catégorie'
        }
      ),
      components: [
        buildCategoryConfirmationRow()
      ]
    });

  const collector =
    confirmation
      .createMessageComponentCollector({
        time: 60 * 1000
      });

  return new Promise(resolve => {
    let finished = false;

    const finish = async result => {
      if (finished) return;
      finished = true;

      collector.stop(
        result
          ? 'confirmed'
          : 'cancelled'
      );

      resolve(result);
    };

    collector.on(
      'collect',
      async interaction => {
        if (
          interaction.user.id !==
          message.author.id
        ) {
          await interaction.reply({
            ...replyEmbedPayload(
              'Seule la personne qui a lancé la commande peut confirmer ce clear.',
              { type: 'error' }
            ),
            flags:
              MessageFlags.Ephemeral
          }).catch(() => {});

          return;
        }

        if (
          interaction.customId ===
          'clearctg_cancel'
        ) {
          await interaction
            .update({
              ...replyEmbedPayload(
                'Aucun message n’a été supprimé.',
                {
                  type: 'info',
                  title:
                    '🧹 Clear catégorie annulé'
                }
              ),
              components: []
            })
            .catch(() => {});

          await finish(false);
          return;
        }

        if (
          interaction.customId ===
          'clearctg_confirm'
        ) {
          await interaction
            .deferUpdate()
            .catch(() => {});

          await confirmation
            .delete()
            .catch(() => {});

          await finish(true);
        }
      }
    );

    collector.on(
      'end',
      async (_, reason) => {
        if (finished) return;

        if (reason === 'time') {
          finished = true;

          await confirmation
            .edit({
              ...replyEmbedPayload(
                'La confirmation a expiré. Aucun message n’a été supprimé.',
                {
                  type: 'warning',
                  title:
                    '⌛ Confirmation expirée'
                }
              ),
              components: []
            })
            .catch(() => {});

          resolve(false);
        }
      }
    );
  });
}

module.exports = {
  name: 'clear',
  aliases: ['clearctg'],
  description: 'Supprime des messages du salon ou de tous les salons d’une catégorie.',
  usage: 'clear [nombre] | clearctg <ID catégorie>',

  async execute(message, args, options = {}) {
    if (!message.guild) return;

    if (!(await isBotOwner(message.author.id))) {
      return;
    }

    const channel = message.channel;

    if (
      options.invokedName ===
        'clearctg'
    ) {
      const categoryId =
        String(
          args[0] || ''
        ).trim();

      if (
        !/^\d{17,20}$/.test(
          categoryId
        )
      ) {
        return message.reply(
          replyEmbedPayload(
            'Utilisation : **+clearctg <ID de la catégorie>**',
            { type: 'error' }
          )
        );
      }

      const category =
        message.guild.channels.cache.get(
          categoryId
        ) ||
        await message.guild.channels
          .fetch(categoryId)
          .catch(() => null);

      if (
        !category ||
        category.type !==
          ChannelType.GuildCategory
      ) {
        return message.reply(
          replyEmbedPayload(
            'Cet ID ne correspond pas à une catégorie accessible de ce serveur.',
            { type: 'error' }
          )
        );
      }

      const confirmed =
        await confirmCategoryClear(
          message,
          category
        );

      if (!confirmed) {
        return;
      }

      await message
        .delete()
        .catch(() => {});

      const result =
        await clearCategory(
          message,
          categoryId
        );

      if (!result.ok) {
        return;
      }

      const failedText =
        result.failedChannels.length
          ? `\n⚠️ **Échec :** ${result.failedChannels.length} salon${result.failedChannels.length > 1 ? 's' : ''}`
          : '';

      await sendStaffLog(
        message.guild,
        'moderation-logs',
        buildDiscordLog({
          title: '🧹 Clear catégorie',
          description:
            `${message.author} a vidé **${result.clearedChannels}/${result.totalChannels} salon${result.totalChannels > 1 ? 's' : ''}** de la catégorie **${result.category.name}**.\n` +
            `**${result.deleted} message${result.deleted > 1 ? 's' : ''}** supprimé${result.deleted > 1 ? 's' : ''}.\n` +
            `-# Commande : +clearctg ${result.category.id}`,
          color: 0x5865f2
        })
      );

      const confirmation =
        await channel.send(
          replyEmbedPayload(
            `**Catégorie :** ${result.category.name}\n` +
            `🧹 **${result.clearedChannels}/${result.totalChannels} salons** nettoyés\n` +
            `🗑️ **${result.deleted} messages** supprimés` +
            failedText,
            {
              type:
                result.failedChannels.length
                  ? 'warning'
                  : 'success',
              title:
                '🧹 Catégorie nettoyée'
            }
          )
        ).catch(() => null);

      if (confirmation) {
        setTimeout(() => {
          confirmation
            .delete()
            .catch(() => {});
        }, 5000);
      }

      return;
    }

    if (
      !channel?.isTextBased?.() ||
      !channel.messages
    ) {
      return;
    }

    let requestedAmount = null;

    if (args[0] !== undefined) {
      requestedAmount = Number(args[0]);

      if (
        !Number.isInteger(requestedAmount) ||
        requestedAmount <= 0
      ) {
        return message.reply(
          replyEmbedPayload(
            'Utilisation : **+clear** ou **+clear <nombre>**',
            { type: 'error' }
          )
        );
      }
    }

    // La commande elle-même n'est pas comptée dans le nombre demandé.
    await message.delete().catch(() => {});

    try {
      const deleted = await clearMessages(
        channel,
        requestedAmount
      );

      await sendStaffLog(
        message.guild,
        'moderation-logs',
        buildDiscordLog({
          title: '🧹 Clear',
          description:
            `${message.author} a supprimé **${deleted} message${deleted > 1 ? 's' : ''}** dans ${channel}.\n` +
            `-# Commande : +clear${requestedAmount !== null ? ` ${requestedAmount}` : ''}`,
          color: 0x5865f2
        })
      );

      const confirmation = await channel.send(
        replyEmbedPayload(
          `**${deleted}** message${deleted > 1 ? 's' : ''} supprimé${deleted > 1 ? 's' : ''}.`,
          {
            type: 'success',
            title: '🧹 Messages supprimés'
          }
        )
      );

      setTimeout(() => {
        confirmation.delete().catch(() => {});
      }, 3000);
    } catch (error) {
      console.error('Erreur +clear :', error);

      const errorMessage = await channel.send(
        replyEmbedPayload(
          'Une erreur est survenue pendant la suppression des messages.',
          { type: 'error' }
        )
      ).catch(() => null);

      if (errorMessage) {
        setTimeout(() => {
          errorMessage.delete().catch(() => {});
        }, 5000);
      }
    }
  }
};
