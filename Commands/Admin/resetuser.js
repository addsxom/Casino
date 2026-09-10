const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const UserCoins =
  require('../../Models/UserCoins.js');

const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');

const {
  formatAmount
} = require('../../utils/formatAmount.js');

const {
  sendStaffLog,
  buildDiscordLog
} = require('../../utils/staffLogs.js');

const {
  requireBotOwner
} = require('../../utils/ownerPermissions.js');

function buildConfirmationRow(disabled = false) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          'resetallusers_confirm'
        )
        .setLabel('Confirmer')
        .setEmoji('✅')
        .setStyle(
          ButtonStyle.Success
        )
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(
          'resetallusers_cancel'
        )
        .setLabel('Annuler')
        .setEmoji('✖️')
        .setStyle(
          ButtonStyle.Danger
        )
        .setDisabled(disabled)
    );
}

function getTotalRemoved(users) {
  return users.reduce(
    (total, user) =>
      total +
      (Number(user.coins) || 0) +
      (Number(user.bank) || 0),
    0
  );
}

module.exports = {
  name: 'resetallusers',
  description:
    'Réinitialiser tous les rep/coins des membres du serveur',

  async execute(message) {
    if (
      !(await requireBotOwner(message))
    ) {
      return;
    }

    try {
      const previewUsers =
        await UserCoins.find({
          guildId: message.guild.id
        });

      if (
        previewUsers.length === 0
      ) {
        return message.reply(
          replyEmbedPayload(
            'Aucun membre du serveur n’a de points de réputation ni de coins à réinitialiser.',
            {
              type: 'warning',
              title:
                '🧹 Aucun compte à réinitialiser'
            }
          )
        );
      }

      const previewTotal =
        getTotalRemoved(
          previewUsers
        );

      const confirmationMessage =
        await message.reply({
          ...replyEmbedPayload(
            'Cette action va réinitialiser **toute l’économie du serveur**.\n\n' +
              '👥 **Comptes concernés :** ' +
              previewUsers.length +
              '\n' +
              '🪙 **Coins qui seront supprimés :** ' +
              formatAmount(
                previewTotal
              ) +
              '\n\n' +
              '⚠️ **Cette action est irréversible.**',
            {
              type: 'warning',
              title:
                '⚠️ Confirmer le reset global'
            }
          ),
          components: [
            buildConfirmationRow()
          ]
        });

      const collector =
        confirmationMessage
          .createMessageComponentCollector({
            time: 60000
          });

      let handled = false;

      collector.on(
        'collect',
        async interaction => {
          if (
            interaction.user.id !==
            message.author.id
          ) {
            return interaction
              .reply({
                ...replyEmbedPayload(
                  'Cette confirmation ne vous appartient pas.',
                  {
                    type: 'error',
                    title:
                      '🛡️ Action refusée'
                  }
                ),
                flags:
                  MessageFlags.Ephemeral
              })
              .catch(() => {});
          }

          if (handled) {
            return interaction
              .deferUpdate()
              .catch(() => {});
          }

          if (
            interaction.customId ===
            'resetallusers_cancel'
          ) {
            handled = true;
            collector.stop('cancelled');

            return interaction
              .update({
                ...replyEmbedPayload(
                  'La réinitialisation globale a été annulée. **Aucune donnée n’a été supprimée.**',
                  {
                    type: 'info',
                    title:
                      '❌ Reset annulé'
                  }
                ),
                components: []
              })
              .catch(() => {});
          }

          if (
            interaction.customId !==
            'resetallusers_confirm'
          ) {
            return interaction
              .deferUpdate()
              .catch(() => {});
          }

          handled = true;

          await interaction
            .update({
              ...replyEmbedPayload(
                'Réinitialisation de tous les comptes en cours...',
                {
                  type: 'warning',
                  title:
                    '🧹 Reset en cours'
                }
              ),
              components: [
                buildConfirmationRow(
                  true
                )
              ]
            })
            .catch(() => {});

          try {
            const users =
              await UserCoins.find({
                guildId:
                  message.guild.id
              });

            const totalRemoved =
              getTotalRemoved(users);

            const result =
              await UserCoins.deleteMany({
                guildId:
                  message.guild.id
              });

            if (
              result.deletedCount === 0
            ) {
              collector.stop(
                'finished'
              );

              return confirmationMessage
                .edit({
                  ...replyEmbedPayload(
                    'Aucun compte n’a finalement été trouvé à réinitialiser.',
                    {
                      type: 'warning',
                      title:
                        '🧹 Aucun compte supprimé'
                    }
                  ),
                  components: []
                })
                .catch(() => {});
            }

            await sendStaffLog(
              message.guild,
              'economy-logs',
              buildDiscordLog({
                title:
                  '🧹 Reset économie global',
                description:
                  `${message.author} a réinitialisé **${result.deletedCount} comptes**.\n` +
                  `**-${formatAmount(totalRemoved)} coins** supprimés.`,
                color:
                  0xed4245
              })
            );

            collector.stop(
              'finished'
            );

            return confirmationMessage
              .edit({
                ...replyEmbedPayload(
                  'Vous avez réinitialisé tous les points de réputation et les coins de tous les membres du serveur.\n\n' +
                    '👥 **Comptes réinitialisés :** ' +
                    result.deletedCount +
                    '\n' +
                    '🪙 **Coins supprimés :** ' +
                    formatAmount(
                      totalRemoved
                    ),
                  {
                    type: 'success',
                    title:
                      '✅ Reset global terminé'
                  }
                ),
                components: []
              })
              .catch(() => {});
          } catch (error) {
            console.error(
              'Erreur +resetallusers :',
              error
            );

            collector.stop(
              'error'
            );

            return confirmationMessage
              .edit({
                ...replyEmbedPayload(
                  'Une erreur s’est produite lors de la réinitialisation. Le reset n’a pas pu être terminé correctement.',
                  {
                    type: 'error',
                    title:
                      '❌ Erreur de reset'
                  }
                ),
                components: []
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
            handled ||
            reason !== 'time'
          ) {
            return;
          }

          handled = true;

          await confirmationMessage
            .edit({
              ...replyEmbedPayload(
                'La confirmation a expiré. **Aucune donnée n’a été supprimée.**',
                {
                  type: 'warning',
                  title:
                    '⌛ Confirmation expirée'
                }
              ),
              components: []
            })
            .catch(() => {});
        }
      );

      return confirmationMessage;
    } catch (error) {
      console.error(
        'Erreur +resetallusers :',
        error
      );

      return message.reply(
        replyEmbedPayload(
          'Une erreur s’est produite lors de la préparation de la réinitialisation.',
          {
            type: 'error',
            title:
              '❌ Erreur de reset'
          }
        )
      );
    }
  }
};
