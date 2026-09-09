const {
  MessageFlags
} = require('discord.js');

const {
  buildModeContainer,
  buildStatusContainer
} = require('./ui.js');

const { replyEmbedPayload } = require('../replyEmbed.js');

async function confirmMinesAll(
  message,
  gameMessage,
  amount
) {
  return new Promise(resolve => {
    let settled = false;

    const collector =
      gameMessage.createMessageComponentCollector({
        time: 60000
      });

    collector.on(
      'collect',
      async interaction => {
        if (
          ![
            'mines_all_accept',
            'mines_all_refuse'
          ].includes(interaction.customId)
        ) {
          return;
        }

        if (
          interaction.user.id !==
          message.author.id
        ) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette confirmation ne vous appartient pas.',
              { type: 'error' }
            ),
            flags:
              MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (settled) return;
        settled = true;

        if (
          interaction.customId ===
          'mines_all_refuse'
        ) {
          await interaction.update({
            components: [
              buildStatusContainer(
                '❌ ALL IN annulé',
                'Aucun coin n’a été retiré.'
              )
            ]
          }).catch(() => {});

          collector.stop('refused');
          resolve(false);
          return;
        }

        await interaction.update({
          components: [
            buildModeContainer(
              message,
              amount
            )
          ]
        }).catch(() => {});

        collector.stop('accepted');
        resolve(true);
      }
    );

    collector.on(
      'end',
      async (_, reason) => {
        if (settled) return;
        settled = true;

        if (reason === 'time') {
          await gameMessage.edit({
            components: [
              buildStatusContainer(
                '⌛ Confirmation expirée',
                'Aucun coin n’a été retiré.'
              )
            ]
          }).catch(() => {});
        }

        resolve(false);
      }
    );
  });
}

module.exports = {
  confirmMinesAll
};
