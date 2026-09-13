const {
  MessageFlags
} = require('discord.js');

const parseAmount =
  require('../../utils/parseAmount.js');
const {
  formatAmount: formatCoins
} = require('../../utils/formatAmount.js');
const {
  replyEmbedPayload
} = require('../../utils/replyEmbed.js');
const {
  getConfiguredChannelId
} = require('../../utils/configService.js');
const {
  reserveGameFunds,
  increaseGameStake,
  settleGameSession,
  refundGameSession
} = require('../../utils/gameRecoveryService.js');
const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
} = require('../../utils/activeGameLock.js');
const {
  sendStaffLog,
  buildCoinMovementLog
} = require('../../utils/staffLogs.js');
const {
  createShuffledDeck,
  drawCard,
  getHandValue,
  isNaturalBlackjack,
  shouldDealerHit,
  resolveOutcome
} = require('../../utils/blackjack/gameRules.js');
const {
  buildTableVisual,
  buildActionRow
} = require('../../utils/blackjack/ui.js');

const DEAL_STEP_MS = 650;
const ACTION_STEP_MS = 550;
const IDLE_MS = 2 * 60 * 1000;
const MAX_GAME_MS = 10 * 60 * 1000;

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

function getResultPresentation(
  outcome,
  state,
  timedOut = false
) {
  const net =
    outcome.payout - state.bet;

  let color;
  let visualStatus;
  let mainText;

  switch (outcome.status) {
    case 'blackjack':
      color = 0xfee75c;
      visualStatus = 'BLACKJACK !';
      mainText =
        '🃏 **Blackjack naturel ! Paiement 3:2.**';
      break;

    case 'dealer_bust':
      color = 0x57f287;
      visualStatus = 'VICTOIRE';
      mainText =
        '💥 **Le croupier dépasse 21. Vous gagnez !**';
      break;

    case 'win':
      color = 0x57f287;
      visualStatus = 'VICTOIRE';
      mainText =
        '🏆 **Votre main bat celle du croupier.**';
      break;

    case 'push':
      color = 0x5865f2;
      visualStatus = 'EGALITE';
      mainText =
        '🤝 **Égalité. Votre mise vous est rendue.**';
      break;

    case 'player_bust':
      color = 0xed4245;
      visualStatus = 'BUST';
      mainText =
        '💥 **Vous dépassez 21. La banque l’emporte.**';
      break;

    case 'dealer_blackjack':
      color = 0xed4245;
      visualStatus = 'BLACKJACK CROUPIER';
      mainText =
        '🎩 **Blackjack du croupier. La banque l’emporte.**';
      break;

    default:
      color = 0xed4245;
      visualStatus = 'DEFAITE';
      mainText =
        '🎩 **La banque l’emporte.**';
      break;
  }

  const sign = net > 0 ? '+' : '';
  const timeoutText =
    timedOut
      ? '\n-# ⌛ Temps écoulé : la main a été automatiquement mise en « Rester ».'
      : '';

  return {
    color,
    visualStatus:
      timedOut
        ? `AUTO STAND - ${visualStatus}`
        : visualStatus,
    visualSubtext:
      `RETOUR ${formatCoins(outcome.payout)} / NET ${sign}${formatCoins(net)}`,
    statusText:
      `${mainText}\n\n` +
      `💰 **Retour :** \`${formatCoins(outcome.payout)} coins\`\n` +
      `📊 **Net :** \`${sign}${formatCoins(net)} coins\`` +
      timeoutText
  };
}

module.exports = {
  name: 'blackjack',
  aliases: ['bj'],
  description:
    'Affrontez le croupier au Blackjack. Ajoutez `all` au nom pour miser toute votre poche.',
  usage: 'blackjack <mise>',

  async execute(message, args, options = {}) {
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const allIn = options.all === true;
    const invokedName =
      options.invokedName ||
      (allIn ? 'blackjackall' : 'blackjack');

    const blackjackChannelId =
      getConfiguredChannelId(
        'blackjack',
        guildId
      );

    if (
      blackjackChannelId &&
      message.channel.id !==
        blackjackChannelId
    ) {
      const warning = await message.reply(
        replyEmbedPayload(
          `Blackjack est uniquement disponible dans <#${blackjackChannelId}>.`,
          {
            type: 'error',
            title: '♠️ Mauvais salon'
          }
        )
      );

      await message.delete().catch(() => {});

      setTimeout(() => {
        warning.delete().catch(() => {});
      }, 5000);

      return;
    }

    let amount = null;

    if (!allIn) {
      amount = parseAmount(args[0]);

      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
      ) {
        return message.reply(
          replyEmbedPayload(
            'Utilisation : **+blackjack <mise>** ou **+bj <mise>**\nExemple : **+bj 1000**',
            { type: 'error' }
          )
        );
      }
    }

    const activeGame =
      tryAcquireActiveGame({
        userId,
        guildId,
        game:
          allIn
            ? 'Blackjack ALL'
            : 'Blackjack',
        channelId:
          message.channel.id
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

    let activeGameToken = activeGame.token;
    let reservation;

    const releaseLock = () => {
      if (!activeGameToken) return;

      releaseActiveGame({
        userId,
        guildId,
        token: activeGameToken
      });

      activeGameToken = null;
    };

    try {
      reservation = await reserveGameFunds({
        userId,
        guildId,
        game: 'blackjack',
        amount,
        allIn
      });
    } catch (error) {
      releaseLock();
      console.error(
        'Blackjack reservation error:',
        error
      );

      return message.reply(
        replyEmbedPayload(
          'Impossible de réserver la mise pour le Blackjack.',
          { type: 'error' }
        )
      );
    }

    if (!reservation) {
      releaseLock();

      return message.reply(
        replyEmbedPayload(
          'Vous n’avez pas assez de coins pour cette mise.',
          { type: 'error' }
        )
      );
    }

    amount = reservation.amount;

    const state = {
      deck: createShuffledDeck(),
      player: [],
      dealer: [],
      bet: amount,
      initialBet: amount,
      doubled: false,
      busy: true,
      finished: false
    };

    let gameMessage = null;
    let collector = null;

    const visualOptions = ({
      revealDealer = false,
      statusText = null,
      visualStatus = null,
      visualSubtext = null,
      color = 0x6b6de6
    } = {}) => ({
      revealDealer,
      statusText:
        statusText ||
        'À toi de jouer.',
      visualStatus,
      visualSubtext,
      color
    });

    const editGame = async ({
      revealDealer = false,
      statusText = null,
      visualStatus = null,
      visualSubtext = null,
      color = 0x6b6de6,
      controls = null
    } = {}) => {
      if (!gameMessage) return;

      const visual = buildTableVisual(
        message,
        state,
        visualOptions({
          revealDealer,
          statusText,
          visualStatus,
          visualSubtext,
          color
        })
      );

      await gameMessage.edit({
        attachments: [],
        embeds: [visual.embed],
        files: [visual.file],
        components:
          controls
            ? [controls]
            : []
      });
    };

    const abortGame = async error => {
      if (state.finished) {
        releaseLock();
        return;
      }

      state.finished = true;
      state.busy = true;

      if (collector) {
        collector.stop('aborted');
      }

      console.error(
        'Blackjack game error:',
        error
      );

      await refundGameSession({
        userId,
        guildId
      }).catch(refundError => {
        console.error(
          'Blackjack refund error:',
          refundError
        );
      });

      if (gameMessage) {
        await gameMessage.edit({
          ...replyEmbedPayload(
            'La partie a rencontré une erreur. La mise réservée a été remboursée.',
            {
              type: 'error',
              title: '♠️ Blackjack interrompu'
            }
          ),
          attachments: [],
          components: []
        }).catch(() => {});
      }

      releaseLock();
    };

    const finishRound = async ({
      outcome = null,
      timedOut = false
    } = {}) => {
      if (state.finished) return;

      outcome =
        outcome ||
        resolveOutcome({
          player: state.player,
          dealer: state.dealer,
          bet: state.bet
        });

      state.finished = true;
      state.busy = true;

      if (collector) {
        collector.stop('finished');
      }

      const presentation =
        getResultPresentation(
          outcome,
          state,
          timedOut
        );

      try {
        const settlement =
          await settleGameSession({
            userId,
            guildId,
            payout: outcome.payout
          });

        if (!settlement?.account) {
          throw new Error(
            'BLACKJACK_RECOVERY_SESSION_MISSING'
          );
        }

        await editGame({
          revealDealer: true,
          statusText:
            presentation.statusText,
          visualStatus:
            presentation.visualStatus,
          visualSubtext:
            presentation.visualSubtext,
          color:
            presentation.color
        }).catch(() => {});

        const net =
          outcome.payout -
          state.bet;

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title:
              `♠️ Blackjack — ${net > 0 ? 'Victoire' : net < 0 ? 'Défaite' : 'Égalité'}`,
            user: message.author,
            delta: net,
            pocket:
              settlement.account.coins,
            bank:
              settlement.account.bank,
            reason: `+${invokedName}`,
            sourceChannel:
              message.channel,
            details:
              `Mise : ${formatCoins(state.bet)} • ` +
              `Retour : ${formatCoins(outcome.payout)} • ` +
              `Joueur : ${outcome.playerValue.total} • ` +
              `Croupier : ${outcome.dealerValue.total}`
          })
        );
      } catch (error) {
        console.error(
          'Blackjack settlement error:',
          error
        );

        await gameMessage.edit({
          ...replyEmbedPayload(
            'Impossible de finaliser proprement la partie. La récupération automatique vérifiera la mise au prochain démarrage si nécessaire.',
            {
              type: 'error',
              title: '♠️ Erreur de règlement'
            }
          ),
          attachments: [],
          components: []
        }).catch(() => {});
      } finally {
        releaseLock();
      }
    };

    const dealerTurn = async ({
      timedOut = false
    } = {}) => {
      if (
        state.finished ||
        state.busy
      ) {
        return;
      }

      state.busy = true;

      await editGame({
        revealDealer: true,
        statusText:
          timedOut
            ? 'Temps écoulé. Le croupier termine la main.'
            : 'Le croupier révèle sa carte cachée...',
        controls:
          buildActionRow({
            canDouble: false,
            disabled: true
          })
      });

      await sleep(ACTION_STEP_MS);

      while (
        !state.finished &&
        shouldDealerHit(state.dealer)
      ) {
        state.dealer.push(
          drawCard(state.deck)
        );

        const value =
          getHandValue(state.dealer);

        await editGame({
          revealDealer: true,
          statusText:
            value.bust
              ? 'Le croupier tire... et dépasse 21.'
              : `Le croupier tire une carte... ${value.total}.`,
          controls:
            buildActionRow({
              canDouble: false,
              disabled: true
            })
        });

        await sleep(ACTION_STEP_MS);
      }

      await finishRound({ timedOut });
    };

    try {
      const initialVisual =
        buildTableVisual(
          message,
          state,
          visualOptions({
            statusText:
              'Le croupier mélange les cartes...'
          })
        );

      gameMessage = await message.reply({
        embeds: [initialVisual.embed],
        files: [initialVisual.file],
        components: []
      });

      updateActiveGame({
        userId,
        guildId,
        token: activeGameToken,
        channelId:
          message.channel.id,
        messageId:
          gameMessage.id
      });

      await sleep(DEAL_STEP_MS);

      state.player.push(drawCard(state.deck));
      await editGame({
        statusText:
          'Première carte pour vous.'
      });

      await sleep(DEAL_STEP_MS);

      state.dealer.push(drawCard(state.deck));
      await editGame({
        statusText:
          'Le croupier prend sa première carte.'
      });

      await sleep(DEAL_STEP_MS);

      state.player.push(drawCard(state.deck));
      await editGame({
        statusText:
          'Votre deuxième carte.'
      });

      await sleep(DEAL_STEP_MS);

      state.dealer.push(drawCard(state.deck));
      await editGame({
        statusText:
          'Une carte reste cachée. Faites votre choix.'
      });

      const hasInitialNatural =
        isNaturalBlackjack(state.player) ||
        isNaturalBlackjack(state.dealer);

      if (hasInitialNatural) {
        await sleep(ACTION_STEP_MS);

        await finishRound({
          outcome:
            resolveOutcome({
              player: state.player,
              dealer: state.dealer,
              bet: state.bet
            })
        });
        return;
      }

      state.busy = false;

      await editGame({
        statusText: 'À vous de jouer.',
        visualStatus: 'A TOI DE JOUER',
        controls:
          buildActionRow({
            canDouble: true
          })
      });
    } catch (error) {
      await abortGame(error);
      return;
    }

    collector =
      gameMessage.createMessageComponentCollector({
        idle: IDLE_MS,
        time: MAX_GAME_MS
      });

    collector.on(
      'collect',
      async interaction => {
        if (
          ![
            'blackjack_hit',
            'blackjack_stand',
            'blackjack_double'
          ].includes(interaction.customId)
        ) {
          return;
        }

        if (interaction.user.id !== userId) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette table ne vous appartient pas.',
              { type: 'error' }
            ),
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (state.finished) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette partie est déjà terminée.',
              { type: 'warning' }
            ),
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (state.busy) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Le croupier termine déjà une animation. Patiente un instant.',
              { type: 'info' }
            ),
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        try {
          await interaction.deferUpdate();

          if (
            interaction.customId ===
            'blackjack_stand'
          ) {
            await dealerTurn();
            return;
          }

          if (
            interaction.customId ===
            'blackjack_hit'
          ) {
            state.busy = true;

            await editGame({
              statusText:
                'Une carte pour vous...',
              controls:
                buildActionRow({
                  canDouble: false,
                  disabled: true
                })
            });

            await sleep(ACTION_STEP_MS);

            state.player.push(
              drawCard(state.deck)
            );

            const value =
              getHandValue(state.player);

            if (value.bust) {
              await finishRound();
              return;
            }

            if (value.total === 21) {
              state.busy = false;
              await dealerTurn();
              return;
            }

            state.busy = false;

            await editGame({
              statusText:
                `${value.total}. Vous tirez encore ou vous restez ?`,
              controls:
                buildActionRow({
                  canDouble: false
                })
            });
            return;
          }

          if (
            state.player.length !== 2 ||
            state.doubled
          ) {
            state.busy = false;

            await interaction.followUp({
              ...replyEmbedPayload(
                'Vous pouvez doubler uniquement avec vos deux premières cartes.',
                { type: 'warning' }
              ),
              flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return;
          }

          state.busy = true;

          await editGame({
            statusText:
              'Le croupier vérifie votre mise doublée...',
            controls:
              buildActionRow({
                canDouble: false,
                disabled: true
              })
          });

          const extraStake = state.bet;
          const increased =
            await increaseGameStake({
              userId,
              guildId,
              amount: extraStake
            });

          if (!increased) {
            state.busy = false;

            await interaction.followUp({
              ...replyEmbedPayload(
                `Il vous faut encore **${formatCoins(extraStake)} coins** dans votre poche pour doubler.`,
                {
                  type: 'warning',
                  title: '💰 Mise insuffisante'
                }
              ),
              flags: MessageFlags.Ephemeral
            }).catch(() => {});

            await editGame({
              statusText:
                'La mise reste inchangée. À vous de jouer.',
              controls:
                buildActionRow({
                  canDouble: true
                })
            });
            return;
          }

          state.bet += extraStake;
          state.doubled = true;

          await sleep(ACTION_STEP_MS);

          state.player.push(
            drawCard(state.deck)
          );

          const value =
            getHandValue(state.player);

          await editGame({
            statusText:
              `Mise doublée à ${formatCoins(state.bet)} coins. Dernière carte : ${value.total}.`,
            controls:
              buildActionRow({
                canDouble: false,
                disabled: true
              })
          });

          await sleep(ACTION_STEP_MS);

          if (value.bust) {
            await finishRound();
            return;
          }

          state.busy = false;
          await dealerTurn();
        } catch (error) {
          await abortGame(error);
        }
      }
    );

    collector.on(
      'end',
      async (_, reason) => {
        if (state.finished) return;

        if (
          reason === 'idle' ||
          reason === 'time'
        ) {
          state.busy = false;

          await dealerTurn({
            timedOut: true
          }).catch(error =>
            abortGame(error)
          );
          return;
        }

        await abortGame(
          new Error(
            `BLACKJACK_COLLECTOR_ENDED:${reason}`
          )
        );
      }
    );
  }
};
