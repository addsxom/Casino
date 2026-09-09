const {
  MessageFlags
} = require('discord.js');
const {
  getConfiguredChannelId
} = require('../../utils/configService.js');

const parseAmount = require('../../utils/parseAmount.js');
const { sleep } = require('../../utils');
const {
  getAccount
} = require('../../utils/economyService.js');
const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
} = require('../../utils/activeGameLock.js');

const {
  MODES
} = require('../../utils/mines/gameRules.js');
const {
  buildModeContainer,
  buildStatusContainer,
  buildAllWarningContainer
} = require('../../utils/mines/ui.js');
const {
  confirmMinesAll
} = require('../../utils/mines/confirmation.js');
const {
  startMinesGameSession
} = require('../../utils/mines/gameSession.js');

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: 'mines',
  description: 'Jouez au Mines. Ajoutez `all` au nom pour miser toute votre poche.',

  async execute(message, args, options = {}) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const minesChannelId = getConfiguredChannelId('mines', guildId);
    let activeGameToken = null;

    if (message.channel.id !== minesChannelId) {
      const warningMessage = await message.reply(
        replyEmbedPayload(
          `Mines est uniquement disponible dans <#${minesChannelId}>.\n🕒 Suppression dans **5 secondes**.`,
          {
            type: 'error',
            title: '💣 Mauvais salon'
          }
        )
      );

      for (let seconds = 4; seconds >= 1; seconds--) {
        await sleep(1000);
        await warningMessage.edit(
          replyEmbedPayload(
            `Mines est uniquement disponible dans <#${minesChannelId}>.\n🕒 Suppression dans **${seconds} seconde${seconds > 1 ? 's' : ''}**.`,
            {
              type: 'error',
              title: '💣 Mauvais salon'
            }
          )
        );
      }

      await sleep(1000);
      await warningMessage.delete().catch(() => {});
      await message.delete().catch(() => {});
      return;
    }

    const allIn = options.all === true;
    const userCoins = await getAccount(
      message.author.id,
      guildId
    );
    const amount = allIn
      ? Number(userCoins?.coins) || 0
      : parseAmount(args[0]);

    if (!Number.isInteger(amount) || amount <= 0) {
      return message.reply(
        replyEmbedPayload(
          allIn
            ? 'Vous n\'avez aucun coin en poche pour faire **+minesall**.'
            : 'Utilisation : **+mines <mise>**\nExemple : **+mines 500**',
          { type: 'error' }
        )
      );
    }

    if (!userCoins || userCoins.coins < amount) {
      return message.reply(
        replyEmbedPayload(
          'Vous n\'avez pas assez de coins pour cette mise.',
          { type: 'error' }
        )
      );
    }

    const activeGame = tryAcquireActiveGame({
      userId,
      guildId,
      game: allIn ? 'Mines ALL' : 'Mines',
      channelId: message.channel.id
    });

    if (!activeGame.acquired) {
      return message.reply({
        embeds: [
          buildActiveGameEmbed(
            message,
            activeGame.activeGame
          )
        ]
      });
    }

    activeGameToken = activeGame.token;

    const releaseGameLock = () => {
      if (!activeGameToken) return;

      releaseActiveGame({
        userId,
        guildId,
        token: activeGameToken
      });
      activeGameToken = null;
    };

    let gameMessage;

    try {
      gameMessage = await message.reply({
        flags: MessageFlags.IsComponentsV2,
        components: [
          allIn
            ? buildAllWarningContainer(
                message,
                amount
              )
            : buildModeContainer(message, amount)
        ]
      });
    } catch (error) {
      releaseGameLock();
      throw error;
    }

    updateActiveGame({
      userId,
      guildId,
      token: activeGameToken,
      channelId: message.channel.id,
      messageId: gameMessage.id
    });

    if (allIn) {
      const accepted = await confirmMinesAll(
        message,
        gameMessage,
        amount
      );

      if (!accepted) {
        releaseGameLock();
        return;
      }
    }

    const modeCollector = gameMessage.createMessageComponentCollector({
      time: 60000
    });

    let modeSelected = false;

    modeCollector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          ...replyEmbedPayload(
            'Cette partie ne vous appartient pas.',
            { type: 'error' }
          ),
          ephemeral: true
        });
      }

      if (!interaction.customId.startsWith('mines_mode_') || modeSelected) {
        return;
      }

      await interaction.deferUpdate();

      modeSelected = true;
      modeCollector.stop('selected');

      const modeKey = interaction.customId.replace('mines_mode_', '');
      const mode = MODES[modeKey];

      if (!mode) {
        releaseGameLock();
        return;
      }

      await startMinesGameSession({
        message,
        gameMessage,
        guildId,
        userId,
        mode,
        amount,
        allIn,
        releaseGameLock
      });
    });

    modeCollector.on('end', async (_, reason) => {
      if (reason !== 'time' || modeSelected) return;

      releaseGameLock();

      await gameMessage.edit({
        components: [
          buildStatusContainer(
            '⌛ Sélection expirée',
            'Aucun mode n\'a été choisi. **Aucun coin n\'a été retiré.**'
          )
        ]
      }).catch(() => {});
    });
  }
};
