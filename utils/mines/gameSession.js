const {
  MessageFlags
} = require('discord.js');

const MinesCooldown =
  require('../../Models/MinesCooldown.js');

const {
  debitBalance,
  drainPocket,
  creditBalance,
  getAccount
} = require('../economyService.js');

const {
  sendStaffLog,
  buildCoinMovementLog
} = require('../staffLogs.js');

const {
  formatAmount: formatCoins
} = require('../formatAmount.js');

const {
  BONUS_BALANCE_FACTOR,
  REVEAL_COST_PERCENT,
  REVEAL_COOLDOWN_MS,
  getBaseMultiplier,
  generateMines,
  generateBonusPositions
} = require('./gameRules.js');

const {
  buildGameContainer,
  buildStatusContainer
} = require('./ui.js');

const { replyEmbedPayload } = require('../replyEmbed.js');

async function startMinesGameSession({
  message,
  gameMessage,
  guildId,
  userId,
  mode,
  amount,
  allIn,
  releaseGameLock
}) {
  let userCoins;

  if (allIn) {
    const drained = await drainPocket(
      userId,
      guildId
    );

    if (!drained || drained.amount <= 0) {
      releaseGameLock();

      return gameMessage.edit({
        components: [
          buildStatusContainer(
            '❌ Mise impossible',
            'Vous n\'avez plus assez de coins pour démarrer cette partie.',
            0xe91e63
          )
        ]
      });
    }

    amount = drained.amount;

    userCoins = await getAccount(
      userId,
      guildId
    );
  } else {
    userCoins = await debitBalance({
      userId,
      guildId,
      source: 'coins',
      amount
    });

    if (!userCoins) {
      releaseGameLock();

      return gameMessage.edit({
        components: [
          buildStatusContainer(
            '❌ Mise impossible',
            'Vous n\'avez plus assez de coins pour démarrer cette partie.',
            0xe91e63
          )
        ]
      });
    }
  }

  const totalCells =
    mode.rows * mode.cols;

  const minePositions =
    generateMines(
      totalCells,
      mode.mines
    );

  const game = {
    amount,
    mode,
    totalCells,
    minePositions,
    bonusPositions:
      generateBonusPositions(
        totalCells,
        minePositions
      ),
    revealed: new Set(),
    peeked: new Set(),
    safeOpened: 0,
    bonusOpened: 0,
    currentMultiplier: 1,
    revealCost: Math.max(
      1,
      Math.ceil(
        amount *
          REVEAL_COST_PERCENT
      )
    ),
    allIn,
    revealAvailableAt: 0,
    revealSelecting: false,
    gameOver: false,
    status: 'playing',
    payout: 0
  };

  const cooldownDoc =
    await MinesCooldown.findOne({
      userId,
      guildId
    });

  game.revealAvailableAt =
    cooldownDoc?.revealAvailableAt
      ? new Date(
          cooldownDoc.revealAvailableAt
        ).getTime()
      : 0;

  let cooldownTimer = null;

  const render = async () => {
    await gameMessage.edit({
      components: [
        buildGameContainer(
          message,
          game
        )
      ]
    });
  };

  const stopCooldownTimer = () => {
    if (!cooldownTimer) return;

    clearInterval(cooldownTimer);
    cooldownTimer = null;
  };

  const ensureCooldownTimer = () => {
    if (
      cooldownTimer ||
      game.gameOver
    ) {
      return;
    }

    if (
      game.revealAvailableAt <=
      Date.now()
    ) {
      return;
    }

    cooldownTimer =
      setInterval(async () => {
        if (game.gameOver) {
          stopCooldownTimer();
          return;
        }

        if (
          game.revealAvailableAt <=
          Date.now()
        ) {
          game.revealAvailableAt = 0;
          stopCooldownTimer();
        }

        await render().catch(() => {});
      }, 1000);
  };

  await render();
  ensureCooldownTimer();

  const gameCollector =
    gameMessage.createMessageComponentCollector({
      time: 120000
    });

  gameCollector.on(
    'collect',
    async interaction => {
      if (
        interaction.user.id !==
        userId
      ) {
        return interaction.reply({
          ...replyEmbedPayload(
            'Cette partie ne vous appartient pas.',
            { type: 'error' }
          ),
          ephemeral: true
        });
      }

      if (game.gameOver) {
        return interaction
          .deferUpdate()
          .catch(() => {});
      }

      await interaction.deferUpdate();

      if (
        interaction.customId ===
        'mines_cashout'
      ) {
        if (game.safeOpened === 0) {
          return;
        }

        game.gameOver = true;
        game.status = 'cashout';
        game.payout = Math.max(
          0,
          Math.floor(
            game.amount *
              game.currentMultiplier
          )
        );

        try {
          userCoins =
            await creditBalance({
              userId,
              guildId,
              target: 'coins',
              amount: game.payout
            });
        } finally {
          releaseGameLock();
        }

        if (userCoins) {
          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title:
                '💣 Mines — Cash Out',
              user: message.author,
              delta:
                game.payout -
                game.amount,
              pocket:
                userCoins.coins,
              bank:
                userCoins.bank,
              reason: '+mines',
              sourceChannel:
                message.channel,
              details:
                `Mode : ${game.mode.label} • Mise : ${formatCoins(game.amount)} • ` +
                `Payout : ${formatCoins(game.payout)}`
            })
          );
        }

        await render();
        stopCooldownTimer();
        gameCollector.stop('finished');
        return;
      }

      if (
        interaction.customId ===
        'mines_reveal'
      ) {
        if (game.allIn) {
          await render();
          return;
        }

        const now = Date.now();

        const cooldownDoc =
          await MinesCooldown.findOne({
            userId,
            guildId
          });

        const storedCooldown =
          cooldownDoc?.revealAvailableAt
            ? new Date(
                cooldownDoc.revealAvailableAt
              ).getTime()
            : 0;

        game.revealAvailableAt =
          Math.max(
            game.revealAvailableAt,
            storedCooldown
          );

        if (
          game.revealAvailableAt >
          now
        ) {
          await render();
          return;
        }

        const hasTarget =
          Array.from(
            {
              length:
                game.totalCells
            },
            (_, i) => i
          ).some(
            i =>
              !game.revealed.has(i) &&
              !game.peeked.has(i)
          );

        if (!hasTarget) return;

        game.revealSelecting = true;
        await render();
        return;
      }

      if (
        !interaction.customId
          .startsWith('mines_cell_')
      ) {
        return;
      }

      const index = Number(
        interaction.customId.replace(
          'mines_cell_',
          ''
        )
      );

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= game.totalCells ||
        game.revealed.has(index)
      ) {
        return;
      }

      if (game.revealSelecting) {
        if (game.peeked.has(index)) {
          return;
        }

        const now = Date.now();

        const cooldownDoc =
          await MinesCooldown.findOne({
            userId,
            guildId
          });

        const storedCooldown =
          cooldownDoc?.revealAvailableAt
            ? new Date(
                cooldownDoc.revealAvailableAt
              ).getTime()
            : 0;

        game.revealAvailableAt =
          Math.max(
            game.revealAvailableAt,
            storedCooldown
          );

        if (
          game.revealAvailableAt >
          now
        ) {
          game.revealSelecting = false;
          await render();
          return;
        }

        const revealPayment =
          await debitBalance({
            userId,
            guildId,
            source: 'coins',
            amount:
              game.revealCost
          });

        if (!revealPayment) {
          game.revealSelecting = false;
          await render();

          await interaction.followUp({
            ...replyEmbedPayload(
              `Il te faut **${formatCoins(game.revealCost)} coins** en poche pour utiliser Reveal.`,
              { type: 'error' }
            ),
            flags:
              MessageFlags.Ephemeral
          }).catch(() => {});

          return;
        }

        userCoins = revealPayment;

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title:
              '🔍 Mines — Reveal',
            user: message.author,
            delta:
              -game.revealCost,
            pocket:
              userCoins.coins,
            bank:
              userCoins.bank,
            reason:
              '+mines • Reveal',
            sourceChannel:
              message.channel,
            details:
              `Mode : ${game.mode.label} • Coût : ${formatCoins(game.revealCost)}`
          })
        );

        game.peeked.add(index);
        game.revealSelecting = false;
        game.revealAvailableAt =
          now +
          REVEAL_COOLDOWN_MS;

        ensureCooldownTimer();

        await MinesCooldown
          .findOneAndUpdate(
            {
              userId,
              guildId
            },
            {
              $set: {
                revealAvailableAt:
                  new Date(
                    game.revealAvailableAt
                  )
              }
            },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true
            }
          );

        await render();
        return;
      }

      game.revealed.add(index);
      game.peeked.delete(index);

      if (
        game.minePositions.has(index)
      ) {
        game.gameOver = true;
        game.status = 'lost';
        releaseGameLock();

        userCoins =
          await getAccount(
            userId,
            guildId
          );

        if (userCoins) {
          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title:
                '💣 Mines — Perte',
              user:
                message.author,
              delta:
                -game.amount,
              pocket:
                userCoins.coins,
              bank:
                userCoins.bank,
              reason: '+mines',
              sourceChannel:
                message.channel,
              details:
                `Mode : ${game.mode.label} • Mise : ${formatCoins(game.amount)}`
            })
          );
        }

        await render();
        stopCooldownTimer();
        gameCollector.stop('finished');
        return;
      }

      const previousBase =
        getBaseMultiplier(
          game.totalCells,
          game.mode.mines,
          game.safeOpened
        );

      const nextBase =
        getBaseMultiplier(
          game.totalCells,
          game.mode.mines,
          game.safeOpened + 1
        );

      const normalIncrease =
        nextBase - previousBase;

      const balancedIncrease =
        normalIncrease /
        BONUS_BALANCE_FACTOR;

      game.safeOpened++;

      if (
        game.bonusPositions.has(index)
      ) {
        game.currentMultiplier +=
          balancedIncrease * 2;
        game.bonusOpened++;
      } else {
        game.currentMultiplier +=
          balancedIncrease;
      }

      const safeCells =
        game.totalCells -
        game.mode.mines;

      if (
        game.safeOpened >= safeCells
      ) {
        game.gameOver = true;
        game.status = 'cleared';
        game.payout = Math.max(
          0,
          Math.floor(
            game.amount *
              game.currentMultiplier
          )
        );

        try {
          userCoins =
            await creditBalance({
              userId,
              guildId,
              target: 'coins',
              amount: game.payout
            });
        } finally {
          releaseGameLock();
        }

        if (userCoins) {
          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title:
                '💣 Mines — Grille terminée',
              user:
                message.author,
              delta:
                game.payout -
                game.amount,
              pocket:
                userCoins.coins,
              bank:
                userCoins.bank,
              reason: '+mines',
              sourceChannel:
                message.channel,
              details:
                `Mode : ${game.mode.label} • Mise : ${formatCoins(game.amount)} • ` +
                `Payout : ${formatCoins(game.payout)}`
            })
          );
        }

        await render();
        stopCooldownTimer();
        gameCollector.stop('finished');
        return;
      }

      await render();
    }
  );

  gameCollector.on(
    'end',
    async (_, reason) => {
      if (
        reason !== 'time' ||
        game.gameOver
      ) {
        return;
      }

      stopCooldownTimer();
      game.gameOver = true;

      const payout =
        game.safeOpened > 0
          ? Math.max(
              0,
              Math.floor(
                game.amount *
                  game.currentMultiplier
              )
            )
          : game.amount;

      try {
        userCoins =
          await creditBalance({
            userId,
            guildId,
            target: 'coins',
            amount: payout
          });
      } finally {
        releaseGameLock();
      }

      if (userCoins) {
        const net =
          payout - game.amount;

        if (net !== 0) {
          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title:
                net > 0
                  ? '💣 Mines — Cash Out auto'
                  : '💣 Mines — Perte auto',
              user:
                message.author,
              delta: net,
              pocket:
                userCoins.coins,
              bank:
                userCoins.bank,
              reason:
                '+mines • partie expirée',
              sourceChannel:
                message.channel,
              details:
                `Mode : ${game.mode.label} • Mise : ${formatCoins(game.amount)} • ` +
                `Payout : ${formatCoins(payout)}`
            })
          );
        }
      }

      await gameMessage.edit({
        components: [
          buildStatusContainer(
            '⌛ Partie expirée',
            game.safeOpened > 0
              ? `Cash Out automatique : **${formatCoins(payout)} coins🪙**.`
              : `Ta mise de **${formatCoins(game.amount)} coins🪙** a été remboursée.`
          )
        ]
      }).catch(() => {});
    }
  );
}

module.exports = {
  startMinesGameSession
};
