const {
  MessageFlags
} = require('discord.js');
const {
  getConfiguredChannelId
} = require('../../utils/configService.js');

const parseAmount = require('../../utils/parseAmount.js');
const MinesCooldown = require('../../Models/MinesCooldown.js');
const { sleep } = require('../../utils');
const { formatAmount: formatCoins } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');
const { debitBalance, drainPocket, creditBalance, getAccount } = require('../../utils/economyService.js');
const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
} = require('../../utils/activeGameLock.js');

const {
  BONUS_BALANCE_FACTOR,
  REVEAL_COST_PERCENT,
  REVEAL_COOLDOWN_MS,
  MODES,
  getBaseMultiplier,
  generateMines,
  generateBonusPositions
} = require('../../utils/mines/gameRules.js');
const {
  buildModeContainer,
  buildGameContainer,
  buildStatusContainer,
  buildAllWarningContainer
} = require('../../utils/mines/ui.js');
const {
  confirmMinesAll
} = require('../../utils/mines/confirmation.js');

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
        `❌・Mines est uniquement disponible dans <#${minesChannelId}>.\n🕒 Suppression dans **5 secondes**.`
      );

      for (let seconds = 4; seconds >= 1; seconds--) {
        await sleep(1000);
        await warningMessage.edit(
          `❌・Mines est uniquement disponible dans <#${minesChannelId}>.\n🕒 Suppression dans **${seconds} seconde${seconds > 1 ? 's' : ''}**.`
        );
      }

      await sleep(1000);
      await warningMessage.delete().catch(() => {});
      await message.delete().catch(() => {});
      return;
    }

    const allIn = options.all === true;
    let userCoins = await getAccount(
      message.author.id,
      guildId
    );
    let amount = allIn
      ? Number(userCoins?.coins) || 0
      : parseAmount(args[0]);

    if (!Number.isInteger(amount) || amount <= 0) {
      return message.reply(
        allIn
          ? '❌・Vous n\'avez aucun coin en poche pour faire **+minesall**.'
          : '❌・Utilisation : **+mines <mise>**\nExemple : **+mines 500**'
      );
    }

    if (!userCoins || userCoins.coins < amount) {
      return message.reply(
        '❌・Vous n\'avez pas assez de coins pour cette mise.'
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
          content: '❌・Cette partie ne vous appartient pas.',
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

      if (allIn) {
        const drained = await drainPocket(
          message.author.id,
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
          message.author.id,
          guildId
        );
      } else {
        userCoins = await debitBalance({
          userId: message.author.id,
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

      const totalCells = mode.rows * mode.cols;
      const minePositions = generateMines(totalCells, mode.mines);

      const game = {
        amount,
        mode,
        totalCells,
        minePositions,
        bonusPositions: generateBonusPositions(totalCells, minePositions),
        revealed: new Set(),
        peeked: new Set(),
        safeOpened: 0,
        bonusOpened: 0,
        currentMultiplier: 1,
        revealCost: Math.max(1, Math.ceil(amount * REVEAL_COST_PERCENT)),
        allIn,
        revealAvailableAt: 0,
        revealSelecting: false,
        gameOver: false,
        status: 'playing',
        payout: 0
      };

      const cooldownDoc = await MinesCooldown.findOne({
        userId: message.author.id,
        guildId
      });

      game.revealAvailableAt = cooldownDoc?.revealAvailableAt
        ? new Date(cooldownDoc.revealAvailableAt).getTime()
        : 0;

      let cooldownTimer = null;

      const render = async () => {
        await gameMessage.edit({
          components: [buildGameContainer(message, game)]
        });
      };

      const stopCooldownTimer = () => {
        if (cooldownTimer) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
        }
      };

      const ensureCooldownTimer = () => {
        if (cooldownTimer || game.gameOver) return;
        if (game.revealAvailableAt <= Date.now()) return;

        cooldownTimer = setInterval(async () => {
          if (game.gameOver) {
            stopCooldownTimer();
            return;
          }

          if (game.revealAvailableAt <= Date.now()) {
            game.revealAvailableAt = 0;
            stopCooldownTimer();
          }

          await render().catch(() => {});
        }, 1000);
      };

      await render();
      ensureCooldownTimer();

      const gameCollector = gameMessage.createMessageComponentCollector({
        time: 120000
      });

      gameCollector.on('collect', async interaction => {
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({
            content: '❌・Cette partie ne vous appartient pas.',
            ephemeral: true
          });
        }

        if (game.gameOver) {
          return interaction.deferUpdate().catch(() => {});
        }

        await interaction.deferUpdate();

        if (interaction.customId === 'mines_cashout') {
          if (game.safeOpened === 0) return;

          game.gameOver = true;
          game.status = 'cashout';
          game.payout = Math.max(
            0,
            Math.floor(game.amount * game.currentMultiplier)
          );

          try {
            userCoins = await creditBalance({
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
                title: '💣 Mines — Cash Out',
                user: message.author,
                delta: game.payout - game.amount,
                pocket: userCoins.coins,
                bank: userCoins.bank,
                reason: '+mines',
                sourceChannel: message.channel,
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

        if (interaction.customId === 'mines_reveal') {
          if (game.allIn) {
            await render();
            return;
          }

          const now = Date.now();

          const cooldownDoc = await MinesCooldown.findOne({
            userId: message.author.id,
            guildId
          });

          const storedCooldown = cooldownDoc?.revealAvailableAt
            ? new Date(cooldownDoc.revealAvailableAt).getTime()
            : 0;

          game.revealAvailableAt = Math.max(
            game.revealAvailableAt,
            storedCooldown
          );

          if (game.revealAvailableAt > now) {
            await render();
            return;
          }

          const hasTarget = Array.from(
            { length: game.totalCells },
            (_, i) => i
          ).some(i => !game.revealed.has(i) && !game.peeked.has(i));

          if (!hasTarget) return;

          // On entre en mode sélection : aucune case n'est Reveal automatiquement.
          game.revealSelecting = true;
          await render();
          return;
        }

        if (!interaction.customId.startsWith('mines_cell_')) return;

        const index = Number(
          interaction.customId.replace('mines_cell_', '')
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
          // Impossible de Reveal une case déjà Reveal.
          if (game.peeked.has(index)) {
            return;
          }

          const now = Date.now();

          const cooldownDoc = await MinesCooldown.findOne({
            userId: message.author.id,
            guildId
          });

          const storedCooldown = cooldownDoc?.revealAvailableAt
            ? new Date(cooldownDoc.revealAvailableAt).getTime()
            : 0;

          game.revealAvailableAt = Math.max(
            game.revealAvailableAt,
            storedCooldown
          );

          if (game.revealAvailableAt > now) {
            game.revealSelecting = false;
            await render();
            return;
          }

          const revealPayment = await debitBalance({
            userId: message.author.id,
            guildId,
            source: 'coins',
            amount: game.revealCost
          });

          if (!revealPayment) {
            game.revealSelecting = false;
            await render();

            await interaction.followUp({
              content:
                `❌・Il te faut **${formatCoins(game.revealCost)} coins** en poche pour utiliser Reveal.`,
              flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return;
          }

          userCoins = revealPayment;

          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title: '🔍 Mines — Reveal',
              user: message.author,
              delta: -game.revealCost,
              pocket: userCoins.coins,
              bank: userCoins.bank,
              reason: '+mines • Reveal',
              sourceChannel: message.channel,
              details:
                `Mode : ${game.mode.label} • Coût : ${formatCoins(game.revealCost)}`
            })
          );

          // La case choisie est seulement dévoilée : elle reste grise.
          game.peeked.add(index);
          game.revealSelecting = false;
          game.revealAvailableAt = now + REVEAL_COOLDOWN_MS;
          ensureCooldownTimer();

          await MinesCooldown.findOneAndUpdate(
            {
              userId: message.author.id,
              guildId
            },
            {
              $set: {
                revealAvailableAt: new Date(game.revealAvailableAt)
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

        // C'est seulement ici qu'une case devient réellement claim.
        game.revealed.add(index);
        game.peeked.delete(index);

        if (game.minePositions.has(index)) {
          game.gameOver = true;
          game.status = 'lost';
          releaseGameLock();

          userCoins = await getAccount(
            message.author.id,
            guildId
          );

          if (userCoins) {
            await sendStaffLog(
              message.guild,
              'economy-logs',
              buildCoinMovementLog({
                title: '💣 Mines — Perte',
                user: message.author,
                delta: -game.amount,
                pocket: userCoins.coins,
                bank: userCoins.bank,
                reason: '+mines',
                sourceChannel: message.channel,
                details: `Mode : ${game.mode.label} • Mise : ${formatCoins(game.amount)}`
              })
            );
          }

          await render();
          stopCooldownTimer();
          gameCollector.stop('finished');
          return;
        }

        const previousBase = getBaseMultiplier(
          game.totalCells,
          game.mode.mines,
          game.safeOpened
        );

        const nextBase = getBaseMultiplier(
          game.totalCells,
          game.mode.mines,
          game.safeOpened + 1
        );

        const normalIncrease = nextBase - previousBase;
        const balancedIncrease =
          normalIncrease / BONUS_BALANCE_FACTOR;

        game.safeOpened++;

        if (game.bonusPositions.has(index)) {
          game.currentMultiplier += balancedIncrease * 2;
          game.bonusOpened++;
        } else {
          game.currentMultiplier += balancedIncrease;
        }

        const safeCells = game.totalCells - game.mode.mines;

        if (game.safeOpened >= safeCells) {
          game.gameOver = true;
          game.status = 'cleared';
          game.payout = Math.max(
            0,
            Math.floor(game.amount * game.currentMultiplier)
          );

          try {
            userCoins = await creditBalance({
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
                title: '💣 Mines — Grille terminée',
                user: message.author,
                delta: game.payout - game.amount,
                pocket: userCoins.coins,
                bank: userCoins.bank,
                reason: '+mines',
                sourceChannel: message.channel,
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
      });

      gameCollector.on('end', async (_, reason) => {
        if (reason !== 'time' || game.gameOver) return;

        stopCooldownTimer();
        game.gameOver = true;

        const payout = game.safeOpened > 0
          ? Math.max(
              0,
              Math.floor(game.amount * game.currentMultiplier)
            )
          : game.amount;

        try {
          userCoins = await creditBalance({
            userId,
            guildId,
            target: 'coins',
            amount: payout
          });
        } finally {
          releaseGameLock();
        }

        if (userCoins) {
          const net = payout - game.amount;

          if (net !== 0) {
            await sendStaffLog(
              message.guild,
              'economy-logs',
              buildCoinMovementLog({
                title: net > 0 ? '💣 Mines — Cash Out auto' : '💣 Mines — Perte auto',
                user: message.author,
                delta: net,
                pocket: userCoins.coins,
                bank: userCoins.bank,
                reason: '+mines • partie expirée',
                sourceChannel: message.channel,
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
