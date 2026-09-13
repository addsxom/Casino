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
  buildTableEmbed,
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

  let title;
  let color;
  let mainText;

  switch (outcome.status) {
    case 'blackjack':
      title = '♠️ BLACKJACK • BLACKJACK !';
      color = 0xfee75c;
      mainText =
        '🃏 **Blackjack naturel ! Paiement 3:2.**';
      break;

    case 'dealer_bust':
      title = '♠️ BLACKJACK • VICTOIRE';
      color = 0x57f287;
      mainText =
        '💥 **Le croupier dépasse 21. Vous gagnez !**';
      break;

    case 'win':
      title = '♠️ BLACKJACK • VICTOIRE';
      color = 0x57f287;
      mainText =
        '🏆 **Votre main bat celle du croupier.**';
      break;

    case 'push':
      title = '♠️ BLACKJACK • ÉGALITÉ';
      color = 0x5865f2;
      mainText =
        '🤝 **Égalité. Votre mise vous est rendue.**';
      break;

    case 'player_bust':
      title = '♠️ BLACKJACK • BUST';
      color = 0xed4245;
      mainText =
        '💥 **Vous dépassez 21. La banque l’emporte.**';
      break;

    case 'dealer_blackjack':
      title = '♠️ BLACKJACK • DÉFAITE';
      color = 0xed4245;
      mainText =
        '🎩 **Blackjack du croupier. La banque l’emporte.**';
      break;

    default:
      title = '♠️ BLACKJACK • DÉFAITE';
      color = 0xed4245;
      mainText =
        '🎩 **La banque l’emporte.**';
      break;
  }

  const sign =
    net > 0
      ? '+'
      : '';

  const timeoutText =
    timedOut
      ? '\n-# ⌛ Temps écoulé : la main a été automatiquement mise en « Rester ».'
      : '';

  return {
    title,
    color,
    statusText:
      `${mainText}\n\n` +
      `💰 **Retour :** \`${formatCoins(outcome.payout)} coins\`\n` +
      `📊 **Net :** \`${sign}${formatCoins(net)} coins\`` +
      timeoutText
  };
}

module.exports = {
  name: 'blackjack',
  description:
    'Affrontez le croupier au Blackjack. Ajoutez `all` au nom pour miser toute votre poche.',
  usage: 'blackjack <mise>',

  async execute(message, args, options = {}) {
    if (!message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const allIn = options.all === true;

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
      const warning =
        await message.reply(
          replyEmbedPayload(
            `Blackjack est uniquement disponible dans <#${blackjackChannelId}>.`,
            {
              type: 'error',
              title: '♠️ Mauvais salon'
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

    let amount = null;

    if (!allIn) {
      amount = parseAmount(args[0]);

      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
      ) {
        return message.reply(
          replyEmbedPayload(
            'Utilisation : **+blackjack <mise>**\nExemple : **+blackjack 1000**',
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

    let activeGameToken =
      activeGame.token;
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
      reservation =
        await reserveGameFunds({
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

    const editGame = async ({
      revealDealer = false,
      statusText = null,
      title = undefined,
      color = undefined,
      controls = null
    } = {}) => {
      if (!gameMessage) return;

      const embed =
        buildTableEmbed(
          message,
          state,
          {
            revealDealer,
            statusText,
            ...(title ? { title } : {}),
            ...(color ? { color } : {})
          }
        );

      await gameMessage.edit({
        embeds: [embed],
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

        const finalEmbed =
          buildTableEmbed(
            message,
            state,
            {
              revealDealer: true,
              statusText:
                presentation.statusText,
              title:
                presentation.title,
              color:
                presentation.color
            }
          )
            .setTimestamp();

        await gameMessage.edit({
          embeds: [finalEmbed],
          components: []
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
            reason:
              allIn
                ? '+blackjackall'
                : '+blackjack',
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
            ? '⌛ **Temps écoulé. Le croupier termine automatiquement la main.**'
            : '🎩 **Le croupier révèle sa carte cachée...**',
        controls:
          buildActionRow({
            canDouble: false,
            disabled: true
          })
      });

      await sleep(ACTION_STEP_MS);

      while (
        !state.finished &&
        shouldDealerHit(
          state.dealer
        )
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
              ? '🎩 **Le croupier tire... et dépasse 21.**'
              : `🎩 **Le croupier tire une carte... ${value.total}.**`,
          controls:
            buildActionRow({
              canDouble: false,
              disabled: true
            })
        });

        await sleep(ACTION_STEP_MS);
      }

      await finishRound({
        timedOut
      });
    };

    try {
      gameMessage =
        await message.reply({
          embeds: [
            buildTableEmbed(
              message,
              state,
              {
                statusText:
                  '🎩 **Le croupier mélange les cartes...**'
              }
            )
          ],
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

      state.player.push(
        drawCard(state.deck)
      );
      await editGame({
        statusText:
          '🎩 **« Première carte pour vous. »**'
      });

      await sleep(DEAL_STEP_MS);

      state.dealer.push(
        drawCard(state.deck)
      );
      await editGame({
        statusText:
          '🎩 **Le croupier prend sa première carte.**'
      });

      await sleep(DEAL_STEP_MS);

      state.player.push(
        drawCard(state.deck)
      );
      await editGame({
        statusText:
          '🎩 **« Votre deuxième carte. »**'
      });

      await sleep(DEAL_STEP_MS);

      state.dealer.push(
        drawCard(state.deck)
      );
      await editGame({
        statusText:
          '🎩 **Une carte reste face cachée. Faites votre choix.**'
      });

      const hasInitialNatural =
        isNaturalBlackjack(
          state.player
        ) ||
        isNaturalBlackjack(
          state.dealer
        );

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
        statusText:
          '🎩 **« À vous de jouer. »**',
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
          ].includes(
            interaction.customId
          )
        ) {
          return;
        }

        if (
          interaction.user.id !==
          userId
        ) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette table ne vous appartient pas.',
              { type: 'error' }
            ),
            flags:
              MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (state.finished) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Cette partie est déjà terminée.',
              { type: 'warning' }
            ),
            flags:
              MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (state.busy) {
          return interaction.reply({
            ...replyEmbedPayload(
              'Le croupier termine déjà une animation. Patiente un instant.',
              { type: 'info' }
            ),
            flags:
              MessageFlags.Ephemeral
          }).catch(() => {});
        }

        try {
          await interaction
            .deferUpdate();

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
                '🎩 **« Une carte pour vous... »**',
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
              getHandValue(
                state.player
              );

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
                `🎩 **« ${value.total}. Vous tirez encore ou vous restez ? »**`,
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
              flags:
                MessageFlags.Ephemeral
            }).catch(() => {});

            return;
          }

          state.busy = true;

          await editGame({
            statusText:
              '💰 **Le croupier vérifie votre mise doublée...**',
            controls:
              buildActionRow({
                canDouble: false,
                disabled: true
              })
          });

          const extraStake =
            state.bet;

          const increased =
            await increaseGameStake({
              userId,
              guildId,
              amount:
                extraStake
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
              flags:
                MessageFlags.Ephemeral
            }).catch(() => {});

            await editGame({
              statusText:
                '🎩 **« La mise reste inchangée. À vous de jouer. »**',
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
            getHandValue(
              state.player
            );

          await editGame({
            statusText:
              `💰 **Mise doublée à ${formatCoins(state.bet)} coins. Une dernière carte : ${value.total}.**`,
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
        if (state.finished) {
          return;
        }

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
