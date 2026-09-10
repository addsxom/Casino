const {
  MessageFlags
} = require('discord.js');

const config =
  require('../../config/botConfig.js');

const {
  getConfiguredChannelId
} = require('../../utils/configService.js');

const parseAmount =
  require('../../utils/parseAmount.js');

const {
  sleep
} = require('../../utils');

const {
  formatAmount
} = require('../../utils/formatAmount.js');

const {
  sendStaffLog,
  buildCoinMovementLog
} = require('../../utils/staffLogs.js');

const {
  debitBalance,
  drainPocket,
  creditBalance,
  getAccount
} = require('../../utils/economyService.js');

const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame
} = require('../../utils/activeGameLock.js');

const {
  getBetOptions,
  generateOutcome,
  generateRollingReels
} = require('../../utils/slots/gameRules.js');

const {
  getMegaPot,
  addToMegaPot,
  claimMegaPot
} = require('../../utils/slots/megaPotService.js');

const {
  buildStatusContainer,
  buildMenuContainer,
  buildSpinContainer,
  buildResultContainer,
  buildExhaustedContainer,
  buildWithdrawnContainer,
  buildExpiredContainer
} = require('../../utils/slots/ui.js');

const SLOT_CONFIG =
  config.games.slots;

function componentReply(
  container,
  extraFlags = 0
) {
  return {
    flags:
      MessageFlags.IsComponentsV2 |
      extraFlags,
    components: [
      container
    ]
  };
}

function buildActiveGameText(
  message,
  activeGame
) {
  const channelId =
    activeGame?.channelId ||
    message.channel.id;

  const messageId =
    activeGame?.messageId;

  let location =
    '📍 Salon : <#' +
    channelId +
    '>';

  if (messageId) {
    const jumpUrl =
      'https://discord.com/channels/' +
      message.guild.id +
      '/' +
      channelId +
      '/' +
      messageId;

    location +=
      '\n🔗 [Voir la partie en cours](' +
      jumpUrl +
      ')';
  }

  return (
    'Tu as déjà une partie de **' +
    (activeGame?.game || 'jeu') +
    '** active.\n\n' +
    location +
    '\n\nTermine cette partie avant d’en lancer une autre.'
  );
}

function getSelectedBet(
  customId,
  cagnotte
) {
  return getBetOptions(
    cagnotte
  ).find(
    option =>
      'slot_bet_' +
      option.key ===
      customId
  ) || null;
}

async function animateSpin(
  gameMessage,
  message,
  finalReels,
  bet
) {
  const step =
    SLOT_CONFIG.animationStepMs;

  const spinStartedAt =
    Date.now();

  while (
    Date.now() -
      spinStartedAt <
    SLOT_CONFIG.spinDurationMs
  ) {
    await gameMessage.edit({
      components: [
        buildSpinContainer(
          message,
          generateRollingReels(
            finalReels,
            0
          ),
          bet,
          'Les trois rouleaux tournent...'
        )
      ]
    });

    await sleep(step);
  }

  await gameMessage.edit({
    components: [
      buildSpinContainer(
        message,
        generateRollingReels(
          finalReels,
          1
        ),
        bet,
        'Premier rouleau arrêté...'
      )
    ]
  });

  await sleep(step);

  await gameMessage.edit({
    components: [
      buildSpinContainer(
        message,
        generateRollingReels(
          finalReels,
          1
        ),
        bet,
        'Premier rouleau arrêté...'
      )
    ]
  });

  await sleep(step);

  await gameMessage.edit({
    components: [
      buildSpinContainer(
        message,
        generateRollingReels(
          finalReels,
          2
        ),
        bet,
        'Deuxième rouleau arrêté...'
      )
    ]
  });

  await sleep(step);

  await gameMessage.edit({
    components: [
      buildSpinContainer(
        message,
        generateRollingReels(
          finalReels,
          2
        ),
        bet,
        'Deuxième rouleau arrêté...'
      )
    ]
  });

  await sleep(step);

  await gameMessage.edit({
    components: [
      buildSpinContainer(
        message,
        finalReels,
        bet,
        'Troisième rouleau arrêté.'
      )
    ]
  });

  await sleep(step);
}

async function sendFinalSessionLog({
  message,
  session,
  returnedAmount,
  account,
  reason
}) {
  if (
    session.logged ||
    !account
  ) {
    return;
  }

  session.logged = true;

  const net =
    Number(returnedAmount) -
    Number(
      session.initialCagnotte
    );

  const details = [
    'Tours : ' +
      session.spins,
    'Misé : ' +
      formatAmount(
        session.totalWagered
      ),
    'Victoires : ' +
      session.wins,
    'Pertes : ' +
      session.losses,
    'MegaPot ajouté : ' +
      formatAmount(
        session.megaPotAdded
      ),
    'MegaPot gagné : ' +
      formatAmount(
        session.megaPotWon
      ),
    'Fin : ' + reason
  ].join(' • ');

  await sendStaffLog(
    message.guild,
    'economy-logs',
    buildCoinMovementLog({
      title:
        net > 0
          ? '🎰 Slots — Session gagnante'
          : net < 0
            ? '🎰 Slots — Session perdante'
            : '🎰 Slots — Session neutre',
      user:
        message.author,
      delta: net,
      pocket:
        account.coins,
      bank:
        account.bank,
      reason:
        session.invocation,
      sourceChannel:
        message.channel,
      details
    })
  ).catch(error => {
    console.error(
      'Erreur log session slots :',
      error
    );
  });
}

module.exports = {
  name: 'slot',
  description:
    'Jouez aux machines à sous avec une cagnotte interactive en Component V2.',

  async execute(
    message,
    args,
    options = {}
  ) {
    if (!message.guild) {
      return;
    }

    const guildId =
      message.guild.id;

    const userId =
      message.author.id;

    const slotChannelId =
      getConfiguredChannelId(
        'slots',
        guildId
      );

    if (
      message.channel.id !==
      slotChannelId
    ) {
      const warningMessage =
        await message.reply(
          componentReply(
            buildStatusContainer(
              '🎰 Mauvais salon',
              'Les slots sont uniquement disponibles dans <#' +
                slotChannelId +
                '>.\n🕒 Suppression dans **5 secondes**.',
              0xed4245
            )
          )
        );

      for (
        let seconds = 4;
        seconds >= 1;
        seconds--
      ) {
        await sleep(1000);

        await warningMessage
          .edit({
            components: [
              buildStatusContainer(
                '🎰 Mauvais salon',
                'Les slots sont uniquement disponibles dans <#' +
                  slotChannelId +
                  '>.\n🕒 Suppression dans **' +
                  seconds +
                  ' seconde' +
                  (
                    seconds > 1
                      ? 's'
                      : ''
                  ) +
                  '**.',
                0xed4245
              )
            ]
          })
          .catch(() => {});
      }

      await sleep(1000);

      await warningMessage
        .delete()
        .catch(() => {});

      await message
        .delete()
        .catch(() => {});

      return;
    }

    const argAll =
      String(args[0] || '')
        .toLowerCase() ===
      'all';

    const allIn =
      options.all === true ||
      argAll;

    const accountBefore =
      await getAccount(
        userId,
        guildId
      );

    const availableCoins =
      Number(
        accountBefore?.coins
      ) || 0;

    const amount =
      allIn
        ? availableCoins
        : parseAmount(
            args[0]
          );

    if (
      !Number.isSafeInteger(
        amount
      ) ||
      amount <= 0
    ) {
      return message.reply(
        componentReply(
          buildStatusContainer(
            '❌ Mise invalide',
            allIn
              ? 'Vous n’avez aucun coin en poche pour ouvrir une cagnotte.'
              : 'Utilisation : **+slot <montant>** ou **+slot all**\nExemple : **+slot 5k**',
            0xed4245
          )
        )
      );
    }

    if (
      !accountBefore ||
      availableCoins <
        amount
    ) {
      return message.reply(
        componentReply(
          buildStatusContainer(
            '❌ Fonds insuffisants',
            'Vous n’avez pas assez de coins en poche pour cette cagnotte.',
            0xed4245
          )
        )
      );
    }

    const activeGame =
      tryAcquireActiveGame({
        userId,
        guildId,
        game:
          allIn
            ? 'Slots ALL'
            : 'Slots',
        channelId:
          message.channel.id
      });

    if (
      !activeGame.acquired
    ) {
      return message.reply(
        componentReply(
          buildStatusContainer(
            '🎮 Partie déjà en cours',
            buildActiveGameText(
              message,
              activeGame.activeGame
            )
          )
        )
      );
    }

    let activeGameToken =
      activeGame.token;

    let reservedAmount = 0;

    const releaseGameLock = () => {
      if (!activeGameToken) {
        return;
      }

      releaseActiveGame({
        userId,
        guildId,
        token:
          activeGameToken
      });

      activeGameToken = null;
    };

    try {
      let accountAfterReserve;

      if (allIn) {
        const drained =
          await drainPocket(
            userId,
            guildId
          );

        if (
          !drained ||
          drained.amount <= 0
        ) {
          releaseGameLock();

          return message.reply(
            componentReply(
              buildStatusContainer(
                '❌ Cagnotte impossible',
                'Vous n’avez plus assez de coins pour démarrer.',
                0xed4245
              )
            )
          );
        }

        reservedAmount =
          drained.amount;

        accountAfterReserve =
          await getAccount(
            userId,
            guildId
          );
      } else {
        accountAfterReserve =
          await debitBalance({
            userId,
            guildId,
            source:
              'coins',
            amount
          });

        if (
          !accountAfterReserve
        ) {
          releaseGameLock();

          return message.reply(
            componentReply(
              buildStatusContainer(
                '❌ Cagnotte impossible',
                'Vous n’avez plus assez de coins pour démarrer.',
                0xed4245
              )
            )
          );
        }

        reservedAmount =
          amount;
      }

      const session = {
        initialCagnotte:
          reservedAmount,
        cagnotte:
          reservedAmount,
        invocation:
          allIn
            ? (
                argAll
                  ? '+slot all'
                  : '+slotall'
              )
            : '+slot',
        spins: 0,
        wins: 0,
        losses: 0,
        totalWagered: 0,
        megaPotAdded: 0,
        megaPotWon: 0,
        spinning: false,
        ended: false,
        logged: false
      };

      let megaPot =
        await getMegaPot(
          guildId
        );

      let gameMessage;

      try {
        gameMessage =
          await message.reply(
            componentReply(
              buildMenuContainer(
                message,
                session,
                megaPot
              )
            )
          );
      } catch (error) {
        await creditBalance({
          userId,
          guildId,
          target:
            'coins',
          amount:
            reservedAmount
        }).catch(() => {});

        reservedAmount = 0;

        releaseGameLock();

        throw error;
      }

      reservedAmount = 0;

      updateActiveGame({
        userId,
        guildId,
        token:
          activeGameToken,
        channelId:
          message.channel.id,
        messageId:
          gameMessage.id
      });

      const collector =
        gameMessage
          .createMessageComponentCollector({
            idle:
              SLOT_CONFIG
                .sessionIdleMs
          });

      const finishWithWithdrawal =
        async (
          containerBuilder,
          reason
        ) => {
          if (session.ended) {
            return null;
          }

          const withdrawn =
            Math.max(
              0,
              Math.floor(
                session.cagnotte
              )
            );

          let account;

          if (withdrawn > 0) {
            account =
              await creditBalance({
                userId,
                guildId,
                target:
                  'coins',
                amount:
                  withdrawn
              });
          } else {
            account =
              await getAccount(
                userId,
                guildId
              );
          }

          if (!account) {
            return null;
          }

          session.ended = true;
          session.spinning = false;

          collector.stop(reason);

          await gameMessage
            .edit({
              components: [
                containerBuilder(
                  withdrawn,
                  account
                )
              ]
            })
            .catch(() => {});

          releaseGameLock();

          await sendFinalSessionLog({
            message,
            session,
            returnedAmount:
              withdrawn,
            account,
            reason
          });

          return account;
        };

      collector.on(
        'collect',
        async interaction => {
          if (
            interaction.user.id !==
            userId
          ) {
            return interaction
              .reply(
                componentReply(
                  buildStatusContainer(
                    '❌ Partie privée',
                    'Cette machine à sous ne vous appartient pas.',
                    0xed4245
                  ),
                  MessageFlags.Ephemeral
                )
              )
              .catch(() => {});
          }

          if (
            session.ended
          ) {
            return interaction
              .deferUpdate()
              .catch(() => {});
          }

          if (
            interaction.customId !==
              'slot_withdraw' &&
            !interaction.customId
              .startsWith(
                'slot_bet_'
              )
          ) {
            return interaction
              .deferUpdate()
              .catch(() => {});
          }

          await interaction
            .deferUpdate()
            .catch(() => {});

          if (
            session.spinning
          ) {
            return;
          }

          if (
            interaction.customId ===
            'slot_withdraw'
          ) {
            await finishWithWithdrawal(
              (
                withdrawn,
                account
              ) =>
                buildWithdrawnContainer(
                  message,
                  session,
                  withdrawn,
                  account.coins
                ),
              'Retrait manuel'
            );

            return;
          }

          const selectedBet =
            getSelectedBet(
              interaction.customId,
              session.cagnotte
            );

          if (
            !selectedBet ||
            selectedBet.amount <= 0 ||
            selectedBet.amount >
              session.cagnotte
          ) {
            megaPot =
              await getMegaPot(
                guildId
              );

            await gameMessage
              .edit({
                components: [
                  buildMenuContainer(
                    message,
                    session,
                    megaPot
                  )
                ]
              })
              .catch(() => {});

            return;
          }

          const bet =
            selectedBet.amount;

          let betSettled = false;

          session.spinning = true;
          session.cagnotte -=
            bet;
          session.spins++;
          session.totalWagered +=
            bet;

          const outcome =
            generateOutcome();

          try {
            await animateSpin(
              gameMessage,
              message,
              outcome.reels,
              bet
            );

            const lines = [];

            let jackpotWon = 0;

            if (outcome.isWin) {
              if (
                outcome.isSeven &&
                bet >=
                  SLOT_CONFIG
                    .megaPotMinBet
              ) {
                jackpotWon =
                  await claimMegaPot(
                    guildId
                  );
              }

              const normalPayout =
                bet * 2;

              const payout =
                normalPayout +
                jackpotWon;

              session.cagnotte +=
                payout;
              session.wins++;

              if (
                jackpotWon > 0
              ) {
                session.megaPotWon +=
                  jackpotWon;
              }

              betSettled = true;

              lines.push(
                '**Vous avez gagné ' +
                  formatAmount(
                    payout
                  ) +
                  ' coins**'
              );

              if (
                outcome.isSeven &&
                bet >=
                  SLOT_CONFIG
                    .megaPotMinBet
              ) {
                lines.push(
                  '🎰 **MEGAPOT remporté : +' +
                    formatAmount(
                      jackpotWon
                    ) +
                    ' coins**'
                );
              } else if (
                outcome.isSeven
              ) {
                lines.push(
                  '-# 777 obtenu, mais il faut miser au moins ' +
                    formatAmount(
                      SLOT_CONFIG
                        .megaPotMinBet
                    ) +
                    ' coins pour remporter le MegaPot.'
                );
              }

              megaPot =
                await getMegaPot(
                  guildId
                );

              await gameMessage.edit({
                components: [
                  buildResultContainer(
                    message,
                    {
                      reels:
                        outcome.reels,
                      lines,
                      won: true,
                      jackpot:
                        jackpotWon > 0
                    }
                  )
                ]
              });
            } else {
              megaPot =
                await addToMegaPot(
                  guildId,
                  bet
                );

              session.losses++;
              session.megaPotAdded +=
                bet;

              betSettled = true;

              lines.push(
                '**Vous avez perdu ' +
                  formatAmount(
                    bet
                  ) +
                  ' coins**'
              );

              lines.push(
                '**+' +
                  formatAmount(
                    bet
                  ) +
                  ' coins ajoutés au MegaPot** (' +
                  formatAmount(
                    megaPot
                  ) +
                  ' coins total)'
              );

              await gameMessage.edit({
                components: [
                  buildResultContainer(
                    message,
                    {
                      reels:
                        outcome.reels,
                      lines,
                      won: false
                    }
                  )
                ]
              });
            }

            await sleep(
              SLOT_CONFIG
                .resultDisplayMs
            );

            if (
              session.cagnotte <= 0
            ) {
              session.cagnotte = 0;
              session.spinning = false;
              session.ended = true;

              collector.stop(
                'Cagnotte épuisée'
              );

              const finalAccount =
                await getAccount(
                  userId,
                  guildId
                );

              await gameMessage
                .edit({
                  components: [
                    buildExhaustedContainer(
                      message,
                      session,
                      finalAccount?.coins ||
                        0
                    )
                  ]
                })
                .catch(() => {});

              releaseGameLock();

              await sendFinalSessionLog({
                message,
                session,
                returnedAmount: 0,
                account:
                  finalAccount,
                reason:
                  'Cagnotte épuisée'
              });

              return;
            }

            megaPot =
              await getMegaPot(
                guildId
              );

            session.spinning = false;

            await gameMessage.edit({
              components: [
                buildMenuContainer(
                  message,
                  session,
                  megaPot
                )
              ]
            });
          } catch (error) {
            console.error(
              'Erreur tour slots :',
              error
            );

            if (
              !betSettled
            ) {
              session.cagnotte +=
                bet;

              session.spins =
                Math.max(
                  0,
                  session.spins - 1
                );

              session.totalWagered =
                Math.max(
                  0,
                  session.totalWagered -
                    bet
                );
            }

            session.spinning = false;

            await interaction
              .followUp(
                componentReply(
                  buildStatusContainer(
                    '❌ Erreur de partie',
                    'Le tour a rencontré une erreur. La cagnotte restante va être retirée automatiquement.',
                    0xed4245
                  ),
                  MessageFlags.Ephemeral
                )
              )
              .catch(() => {});

            await finishWithWithdrawal(
              (
                withdrawn,
                account
              ) =>
                buildWithdrawnContainer(
                  message,
                  session,
                  withdrawn,
                  account.coins
                ),
              'Erreur de partie'
            );
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
            session.ended ||
            reason !== 'idle'
          ) {
            return;
          }

          const withdrawn =
            Math.max(
              0,
              Math.floor(
                session.cagnotte
              )
            );

          let account;

          if (withdrawn > 0) {
            account =
              await creditBalance({
                userId,
                guildId,
                target:
                  'coins',
                amount:
                  withdrawn
              }).catch(
                () => null
              );
          } else {
            account =
              await getAccount(
                userId,
                guildId
              ).catch(
                () => null
              );
          }

          if (!account) {
            releaseGameLock();
            return;
          }

          session.ended = true;
          session.spinning = false;

          await gameMessage
            .edit({
              components: [
                buildExpiredContainer(
                  message,
                  session,
                  withdrawn,
                  account.coins
                )
              ]
            })
            .catch(() => {});

          releaseGameLock();

          await sendFinalSessionLog({
            message,
            session,
            returnedAmount:
              withdrawn,
            account,
            reason:
              'Session expirée'
          });
        }
      );
    } catch (error) {
      if (
        reservedAmount > 0
      ) {
        await creditBalance({
          userId,
          guildId,
          target:
            'coins',
          amount:
            reservedAmount
        }).catch(() => {});
      }

      releaseGameLock();

      console.error(
        'Erreur commande slot :',
        error
      );

      return message
        .reply(
          componentReply(
            buildStatusContainer(
              '❌ Erreur',
              'Une erreur s’est produite lors du lancement de la machine à sous.',
              0xed4245
            )
          )
        )
        .catch(() => {});
    }
  }
};
