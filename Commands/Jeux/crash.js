const {
  formatAmount: formatCoins
} = require('../../utils/formatAmount.js');
const parseAmount =
  require('../../utils/parseAmount.js');
const {
  sendStaffLog,
  buildCoinMovementLog
} = require('../../utils/staffLogs.js');
const {
  getAccount
} = require('../../utils/economyService.js');
const {
  reserveGameFunds,
  settleGameSession,
  refundGameSession
} = require('../../utils/gameRecoveryService.js');
const {
  getConfiguredChannelId
} = require('../../utils/configService.js');
const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
} = require('../../utils/activeGameLock.js');
const {
  LIVE_UPDATE_MS,
  generateCrashPoint,
  getMultiplierAt
} = require('../../utils/crash/gameRules.js');
const {
  buildPlayingEmbed,
  buildResultEmbed,
  buildCashoutRow
} = require('../../utils/crash/ui.js');

const { replyEmbedPayload } = require('../../utils/replyEmbed.js');

module.exports = {
  name: 'crash',
  description:
    'Misez des coins et cash out avant le crash. Ajoutez `all` au nom pour miser toute votre poche.',

  async execute(message, args, options = {}) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const allIn = options.all === true;

    const crashChannelId =
      getConfiguredChannelId(
        'crash',
        guildId
      );

    if (
      crashChannelId &&
      message.channel.id !==
        crashChannelId
    ) {
      const warning =
        await message.reply(
          replyEmbedPayload(
            `Crash est uniquement disponible dans <#${crashChannelId}>.`,
            {
              type: 'error',
              title: '🚀 Mauvais salon'
            }
          )
        );

      await message
        .delete()
        .catch(() => {});

      setTimeout(() => {
        warning
          .delete()
          .catch(() => {});
      }, 5000);

      return;
    }
    let amount;
    let userCoins;
    let activeGameToken = null;

    if (!allIn) {
      amount = parseAmount(args[0]);

      if (
        !Number.isInteger(amount) ||
        amount <= 0
      ) {
        return message.reply(
          replyEmbedPayload(
            'Utilisation : **+crash <mise>**\nExemple : **+crash 1000**',
            { type: 'error' }
          )
        );
      }
    }

    const activeGame = tryAcquireActiveGame({
      userId,
      guildId,
      game: allIn ? 'Crash ALL' : 'Crash',
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

    let reservation;

    try {
      reservation =
        await reserveGameFunds({
          userId,
          guildId,
          game: 'crash',
          amount,
          allIn
        });
    } catch (error) {
      releaseActiveGame({
        userId,
        guildId,
        token: activeGameToken
      });
      activeGameToken = null;

      console.error(
        'Crash reservation error:',
        error
      );

      return message.reply(
        replyEmbedPayload(
          'Impossible de réserver la mise pour le Crash.',
          { type: 'error' }
        )
      );
    }

    if (!reservation) {
      releaseActiveGame({
        userId,
        guildId,
        token: activeGameToken
      });
      activeGameToken = null;

      return message.reply(
        replyEmbedPayload(
          'Vous n\'avez pas assez de coins pour cette mise.',
          { type: 'error' }
        )
      );
    }

    amount =
      reservation.amount;

    userCoins =
      reservation.account;

    const game = {
      amount,
      crashPoint: generateCrashPoint(),
      multiplier: 1,
      cashoutMultiplier: 0,
      payout: 0,
      status: 'playing',
      ended: false,
      locked: false,
      startedAt: Date.now()
    };

    let gameMessage;

    try {
      gameMessage = await message.reply({
        embeds: [
          buildPlayingEmbed(
            message,
            game
          )
        ],
        components: buildCashoutRow()
      });
    } catch (error) {
      await refundGameSession({
        userId,
        guildId
      });

      if (activeGameToken) {
        releaseActiveGame({
          userId,
          guildId,
          token: activeGameToken
        });
        activeGameToken = null;
      }

      console.error(
        'Crash start error:',
        error
      );

      return message.reply(
        replyEmbedPayload(
          'Impossible de lancer le Crash.',
          { type: 'error' }
        )
      );
    }

    updateActiveGame({
      userId,
      guildId,
      token: activeGameToken,
      channelId: message.channel.id,
      messageId: gameMessage.id
    });

    // L'horloge commence quand le message est réellement envoyé.
    game.startedAt = Date.now();

    const collector =
      gameMessage.createMessageComponentCollector({
        time: 180000
      });

    const finishLoss = async () => {
      if (game.ended || game.locked) {
        return;
      }

      game.ended = true;
      game.status = 'lost';
      game.multiplier =
        game.crashPoint;

      clearInterval(liveTimer);
      collector.stop('crashed');

      await gameMessage.edit({
        embeds: [
          buildResultEmbed(
            message,
            game
          )
        ],
        components: []
      }).catch(() => {});

      try {
        const settlement =
          await settleGameSession({
            userId,
            guildId,
            payout: 0
          });

        const latestCoins =
          settlement?.account ||
          await getAccount(
            userId,
            guildId
          );

        if (latestCoins) {
          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title: '🚀 Crash — Perte',
              user: message.author,
              delta: -game.amount,
              pocket: latestCoins.coins,
              bank: latestCoins.bank,
              reason: allIn ? '+crashall' : '+crash',
              sourceChannel: message.channel,
              details: `Mise : ${formatCoins(game.amount)} • Crash : x${game.crashPoint.toFixed(2)}`
            })
          );
        }
      } finally {
        if (activeGameToken) {
          releaseActiveGame({
            userId,
            guildId,
            token: activeGameToken
          });
          activeGameToken = null;
        }
      }
    };

    const liveTimer = setInterval(() => {
      if (
        game.ended ||
        game.locked
      ) {
        return;
      }

      const now = Date.now();
      const multiplier =
        getMultiplierAt(
          game.startedAt,
          now
        );

      if (
        multiplier >=
        game.crashPoint
      ) {
        finishLoss().catch(error => {
          console.error(
            'Crash loss error:',
            error
          );
        });
        return;
      }

      game.multiplier =
        multiplier;

      // Mise à jour légère : uniquement embed + composants.
      gameMessage.edit({
        embeds: [
          buildPlayingEmbed(
            message,
            game
          )
        ],
        components: buildCashoutRow()
      }).catch(() => {});
    }, LIVE_UPDATE_MS);

    collector.on(
      'collect',
      async interaction => {
        if (
          interaction.customId !==
          'crash_cashout'
        ) {
          return;
        }

        if (
          interaction.user.id !==
          message.author.id
        ) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette partie ne vous appartient pas.',
              { type: 'error' }
            ),
            ephemeral: true
          }).catch(() => {});
        }

        if (
          game.ended ||
          game.locked
        ) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette partie est déjà terminée.',
              {
                type: 'warning',
                title: '💥 Partie terminée'
              }
            ),
            ephemeral: true
          }).catch(() => {});
        }

        const clickedAt = Date.now();

        // À partir d'ici aucun tick ne peut reprendre.
        game.locked = true;
        clearInterval(liveTimer);

        const clickedMultiplier =
          getMultiplierAt(
            game.startedAt,
            clickedAt
          );

        if (
          clickedMultiplier >=
          game.crashPoint
        ) {
          game.locked = false;

          await interaction.deferUpdate()
            .catch(() => {});

          await finishLoss();
          return;
        }

        game.ended = true;
        game.status = 'cashed';
        game.multiplier =
          clickedMultiplier;
        game.cashoutMultiplier =
          clickedMultiplier;

        game.payout = Math.floor(
          game.amount *
          clickedMultiplier
        );

        collector.stop('cashed');

        await interaction
          .deferUpdate()
          .catch(() => {});

        try {
          const settlement =
            await settleGameSession({
              userId,
              guildId,
              payout:
                game.payout
            });

          userCoins =
            settlement?.account;

          if (!userCoins) {
            throw new Error(
              'CRASH_RECOVERY_SESSION_MISSING'
            );
          }

          await gameMessage.edit({
            embeds: [
              buildResultEmbed(
                message,
                game
              )
            ],
            components: []
          });

          if (userCoins) {
            await sendStaffLog(
              message.guild,
              'economy-logs',
              buildCoinMovementLog({
                title: '🚀 Crash — Cash Out',
                user: message.author,
                delta: game.payout - game.amount,
                pocket: userCoins.coins,
                bank: userCoins.bank,
                reason: allIn ? '+crashall' : '+crash',
                sourceChannel: message.channel,
                details:
                  `Mise : ${formatCoins(game.amount)} • ` +
                  `Payout : ${formatCoins(game.payout)} • ` +
                  `x${game.cashoutMultiplier.toFixed(2)}`
              })
            );
          }
        } finally {
          if (activeGameToken) {
            releaseActiveGame({
              userId,
              guildId,
              token: activeGameToken
            });
            activeGameToken = null;
          }
        }
      }
    );

    collector.on(
      'end',
      async (_, reason) => {
        if (game.ended) {
          return;
        }

        if (reason === 'time') {
          await finishLoss();
        }
      }
    );
  }
};
