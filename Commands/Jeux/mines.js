const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} = require('discord.js');
const config = require('../../config/botConfig.js');

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
  bonusChance: BONUS_CHANCE,
  revealCostPercent: REVEAL_COST_PERCENT,
  revealCooldownMs: REVEAL_COOLDOWN_MS
} = config.games.mines;
const BONUS_BALANCE_FACTOR = 1 + BONUS_CHANCE;

const MODES = {
  rapide: { label: '⚡ Rapide', rows: 3, cols: 3, mines: 1, color: 0x3498db },
  classique: { label: '💣 Classique', rows: 4, cols: 4, mines: 3, color: 0x6b6de6 },
  complexe: { label: '🔥 Complexe', rows: 4, cols: 5, mines: 6, color: 0xe67e22 }
};

function formatCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getBaseMultiplier(totalCells, mines, safeOpened) {
  if (safeOpened <= 0) return 1;

  let survivalProbability = 1;

  for (let i = 0; i < safeOpened; i++) {
    survivalProbability *= (totalCells - mines - i) / (totalCells - i);
  }

  return Math.max(1, 0.97 / survivalProbability);
}

function generateMines(totalCells, mineCount) {
  const positions = new Set();

  while (positions.size < mineCount) {
    positions.add(Math.floor(Math.random() * totalCells));
  }

  return positions;
}

function generateBonusPositions(totalCells, minePositions) {
  const positions = new Set();

  for (let i = 0; i < totalCells; i++) {
    if (!minePositions.has(i) && Math.random() < BONUS_CHANCE) {
      positions.add(i);
    }
  }

  return positions;
}

function buildModeContainer(message, amount) {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mines_mode_rapide')
      .setLabel('Rapide')
      .setEmoji('⚡')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('mines_mode_classique')
      .setLabel('Classique')
      .setEmoji('💣')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('mines_mode_complexe')
      .setLabel('Complexe')
      .setEmoji('🔥')
      .setStyle(ButtonStyle.Danger)
  );

  return new ContainerBuilder()
    .setAccentColor(0x6b6de6)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# 💣 MINES\n` +
        `**Mise :** ${formatCoins(amount)} coins🪙\n` +
        `\u200B\n` +
        `Choisis ton mode de jeu :`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `⚡ **Rapide** — 3×3 • 1 mine\n` +
        `💣 **Classique** — 4×4 • 3 mines\n` +
        `🔥 **Complexe** — 5×4 • 6 mines\n` +
        `\u200B\n` +
        `🍀 **Case bonus :** 10 % de chance • bonus de gain ×2 sur la case`
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addActionRowComponents(buttons)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${message.author.tag} • Choisis une difficulté`
      )
    );
}

function buildGridRows(game) {
  const {
    mode,
    revealed,
    peeked,
    minePositions,
    bonusPositions,
    gameOver,
    safeOpened,
    revealAvailableAt,
    revealCost,
    revealSelecting,
    allIn
  } = game;

  const rows = [];

  for (let row = 0; row < mode.rows; row++) {
    const actionRow = new ActionRowBuilder();

    for (let col = 0; col < mode.cols; col++) {
      const index = row * mode.cols + col;
      const isClaimed = revealed.has(index);
      const isPeeked = peeked.has(index);
      const isMine = minePositions.has(index);
      const isBonus = bonusPositions.has(index);

      let emoji = '⬜';
      let style = ButtonStyle.Secondary;
      let disabled = false;

      if (gameOver) {
        disabled = true;

        if (isMine) {
          emoji = '💣';
          style = ButtonStyle.Danger;
        } else if (isBonus) {
          emoji = '🍀';
          style = isClaimed ? ButtonStyle.Success : ButtonStyle.Secondary;
        } else {
          emoji = '⭐';
          style = isClaimed ? ButtonStyle.Success : ButtonStyle.Secondary;
        }
      } else if (isClaimed) {
        disabled = true;

        if (isMine) {
          emoji = '💣';
          style = ButtonStyle.Danger;
        } else if (isBonus) {
          emoji = '🍀';
          style = ButtonStyle.Success;
        } else {
          emoji = '⭐';
          style = ButtonStyle.Success;
        }
      } else if (isPeeked) {
        // Une case déjà Reveal reste grise et cliquable hors mode sélection.
        emoji = isMine ? '💣' : isBonus ? '🍀' : '⭐';
        style = ButtonStyle.Secondary;
        disabled = revealSelecting;
      }

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines_cell_${index}`)
          .setEmoji(emoji)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }

    rows.push(actionRow);
  }

  if (!gameOver) {
    const hasRevealTarget = Array.from(
      { length: mode.rows * mode.cols },
      (_, i) => i
    ).some(i => !revealed.has(i) && !peeked.has(i));

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mines_cashout')
          .setLabel('Cash Out')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success)
          .setDisabled(safeOpened === 0 || revealSelecting),

        (() => {
          const remainingMs = Math.max(0, revealAvailableAt - Date.now());
          const cooldownActive = remainingMs > 0;

          return new ButtonBuilder()
            .setCustomId('mines_reveal')
            .setLabel(
              allIn
                ? 'Reveal indisponible'
                : revealSelecting
                  ? 'Choisis une case...'
                  : cooldownActive
                    ? `Reveal • ${formatCooldown(remainingMs)}`
                    : `Reveal • ${formatCoins(revealCost)}`
            )
            .setEmoji('🔍')
            .setStyle(
              allIn || cooldownActive
                ? ButtonStyle.Secondary
                : ButtonStyle.Primary
            )
            .setDisabled(
              allIn ||
              revealSelecting ||
              cooldownActive ||
              !hasRevealTarget
            );
        })()
      )
    );
  }

  return rows;
}

function buildGameContainer(message, game) {
  const {
    amount,
    mode,
    safeOpened,
    bonusOpened,
    currentMultiplier,
    revealAvailableAt,
    revealCost,
    allIn,
    status,
    payout
  } = game;

  const currentGain = Math.max(
    0,
    Math.floor(amount * currentMultiplier)
  );

  const remainingRevealMs = Math.max(0, revealAvailableAt - Date.now());
  const revealStatus = allIn
    ? 'indisponible avec **+minesall**'
    : game.revealSelecting
      ? 'choisis une case cachée'
      : remainingRevealMs > 0
        ? `cooldown **${formatCooldown(remainingRevealMs)}**`
        : 'disponible maintenant';

  let title = '# 💣 MINES';
  let body =
    `**Mode :** ${mode.label}\n` +
    `**Mise :** ${formatCoins(amount)} coins🪙\n` +
    `**Mines :** ${mode.mines}\n` +
    `**Cases sûres :** ${safeOpened}\n` +
    `**Bonus 🍀 trouvés :** ${bonusOpened}\n` +
    `**Multiplicateur :** x${currentMultiplier.toFixed(2)}\n` +
    `**Gain actuel :** ${formatCoins(currentGain)} coins🪙\n` +
    `**🔍 Reveal :** ${formatCoins(revealCost)} coins • ${revealStatus}`;

  let color = mode.color;

  if (status === 'lost') {
    title = '# 💥 BOOM !';
    body =
      `Tu as touché une mine et perdu **${formatCoins(amount)} coins🪙**.\n` +
      `\u200B\n` +
      `💣 mine • ⭐ vert = claim • ⭐ gris = non claim\n` +
      `🍀 vert = bonus claim • 🍀 gris = bonus non claim`;
    color = 0xe91e63;
  } else if (status === 'cashout') {
    title = '# 💰 CASH OUT';
    body =
      `Tu as encaissé **${formatCoins(payout)} coins🪙**.\n` +
      `**Multiplicateur final :** x${currentMultiplier.toFixed(2)}\n` +
      `**Cases sûres :** ${safeOpened}\n` +
      `**Bonus 🍀 trouvés :** ${bonusOpened}`;
    color = 0x4caf50;
  } else if (status === 'cleared') {
    title = '# 🏆 GRILLE TERMINÉE';
    body =
      `Tu as trouvé toutes les cases sûres !\n` +
      `**Gain :** ${formatCoins(payout)} coins🪙\n` +
      `**Multiplicateur final :** x${currentMultiplier.toFixed(2)}\n` +
      `**Bonus 🍀 trouvés :** ${bonusOpened}`;
    color = 0xf1c40f;
  }

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title),
      new TextDisplayBuilder().setContent(body)
    )
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  buildGridRows(game).forEach(row => container.addActionRowComponents(row));

  container
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        game.gameOver
          ? `-# ${message.author.tag} • Partie terminée`
          : game.revealSelecting
            ? `-# ${message.author.tag} • 🔍 Clique maintenant sur la case que tu veux Reveal`
            : allIn
              ? `-# ${message.author.tag} • Mode ALL • 🔍 Reveal indisponible`
              : `-# ${message.author.tag} • ⭐ normal • 🍀 bonus • 🔍 Reveal = 20 % de la mise`
      )
    );

  return container;
}

function buildStatusContainer(title, text, color = 0x95a5a6) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${title}\n${text}`)
    );
}

function getMaxBetWithReveal(balance) {
  let amount = Math.floor(
    balance / (1 + REVEAL_COST_PERCENT)
  );

  while (
    amount > 0 &&
    amount +
      Math.max(
        1,
        Math.ceil(amount * REVEAL_COST_PERCENT)
      ) > balance
  ) {
    amount--;
  }

  return Math.max(0, amount);
}

function buildAllWarningContainer(message, pocketAmount) {
  const suggestedBet = getMaxBetWithReveal(
    pocketAmount
  );
  const revealReserve = suggestedBet > 0
    ? Math.max(
        1,
        Math.ceil(
          suggestedBet * REVEAL_COST_PERCENT
        )
      )
    : 0;

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mines_all_accept')
      .setLabel('Accepter')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('mines_all_refuse')
      .setLabel('✕ Refuser')
      .setStyle(ButtonStyle.Danger)
  );

  let tip =
    'Si tu veux garder Reveal, utilise plutôt **+mines <montant>** et garde assez de coins en poche.';

  if (suggestedBet > 0) {
    tip =
      `Avec ta poche actuelle, tu peux par exemple faire **+mines ${suggestedBet}** ` +
      `et garder environ **${formatCoins(revealReserve)} coins** pour 1 Reveal.`;
  }

  return new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ⚠️ MINES ALL\n` +
        `Tu vas miser **toute ta poche : ${formatCoins(pocketAmount)} coins🪙**.\n` +
        `\u200B\n` +
        `🔍 Un Reveal coûte **20 % de la mise**. Avec **+minesall**, il ne restera aucun coin pour le payer, donc **Reveal sera désactivé pendant cette partie**.\n` +
        `\u200B\n` +
        tip
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    )
    .addActionRowComponents(buttons)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${message.author.tag} • Confirme le ALL IN`
      )
    );
}

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

    collector.on('collect', async interaction => {
      if (
        ![
          'mines_all_accept',
          'mines_all_refuse'
        ].includes(interaction.customId)
      ) {
        return;
      }

      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content:
            '❌・Cette confirmation ne vous appartient pas.',
          flags: MessageFlags.Ephemeral
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
          buildModeContainer(message, amount)
        ]
      }).catch(() => {});

      collector.stop('accepted');
      resolve(true);
    });

    collector.on('end', async (_, reason) => {
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
    });
  });
}

module.exports = {
  name: 'mines',
  description: 'Jouez au Mines. Ajoutez `all` au nom pour miser toute votre poche.',

  async execute(message, args, options = {}) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const minesChannelId = config.channels.games.mines;
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
