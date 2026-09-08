const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags
} = require('discord.js');

const UserCoins = require('../../Models/UserCoins.js');
const parseAmount = require('../../utils/parseAmount.js');
const MinesCooldown = require('../../Models/MinesCooldown.js');
const { sleep } = require('../../utils');

const MINES_CHANNEL_ID = '1546311653564620899';
const BONUS_CHANCE = 0.10;
const REVEAL_COST_PERCENT = 0.20;
const REVEAL_COOLDOWN_MS = 2 * 60 * 1000;

const MODES = {
  rapide: { label: '⚡ Rapide', rows: 3, cols: 3, mines: 1, color: 0x3498db },
  classique: { label: '💣 Classique', rows: 4, cols: 4, mines: 3, color: 0x6b6de6 },
  complexe: { label: '🔥 Complexe', rows: 4, cols: 5, mines: 6, color: 0xe67e22 }
};

function formatCoins(amount) {
  return Math.floor(amount).toLocaleString('fr-FR');
}

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
    revealSelecting
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
              revealSelecting
                ? 'Choisis une case...'
                : cooldownActive
                  ? `Reveal • ${formatCooldown(remainingMs)}`
                  : `Reveal • ${formatCoins(revealCost)}`
            )
            .setEmoji('🔍')
            .setStyle(
              cooldownActive
                ? ButtonStyle.Secondary
                : ButtonStyle.Primary
            )
            .setDisabled(
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
    revealFees,
    status,
    payout
  } = game;

  const currentGain = Math.max(
    0,
    Math.floor(amount * currentMultiplier) - revealFees
  );

  const remainingRevealMs = Math.max(0, revealAvailableAt - Date.now());
  const revealStatus = game.revealSelecting
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

module.exports = {
  name: 'mines',
  description: 'Jouez au Mines avec une mise et plusieurs niveaux de difficulté.',

  async execute(message, args) {
    const guildId = message.guild.id;

    if (message.channel.id !== MINES_CHANNEL_ID) {
      const warningMessage = await message.reply(
        `❌・Mines est uniquement disponible dans <#${MINES_CHANNEL_ID}>.\n🕒 Suppression dans **5 secondes**.`
      );

      for (let seconds = 4; seconds >= 1; seconds--) {
        await sleep(1000);
        await warningMessage.edit(
          `❌・Mines est uniquement disponible dans <#${MINES_CHANNEL_ID}>.\n🕒 Suppression dans **${seconds} seconde${seconds > 1 ? 's' : ''}**.`
        );
      }

      await sleep(1000);
      await warningMessage.delete().catch(() => {});
      await message.delete().catch(() => {});
      return;
    }

    const amount = parseAmount(args[0]);

    if (!Number.isInteger(amount) || amount <= 0) {
      return message.reply(
        '❌・Utilisation : **+mines <mise>**\nExemple : **+mines 500**'
      );
    }

    let userCoins = await UserCoins.findOne({
      userId: message.author.id,
      guildId
    });

    if (!userCoins || userCoins.coins < amount) {
      return message.reply(
        '❌・Vous n\'avez pas assez de coins pour cette mise.'
      );
    }

    const gameMessage = await message.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildModeContainer(message, amount)]
    });

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
      if (!mode) return;

      userCoins = await UserCoins.findOne({
        userId: message.author.id,
        guildId
      });

      if (!userCoins || userCoins.coins < amount) {
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

      userCoins.coins -= amount;
      await userCoins.save();

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
        revealFees: 0,
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
            Math.floor(game.amount * game.currentMultiplier) - game.revealFees
          );

          userCoins = await UserCoins.findOne({
            userId: message.author.id,
            guildId
          });

          if (userCoins) {
            userCoins.coins += game.payout;
            await userCoins.save();
          }

          await render();
          stopCooldownTimer();
          gameCollector.stop('finished');
          return;
        }

        if (interaction.customId === 'mines_reveal') {
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

          // La case choisie est seulement dévoilée : elle reste grise.
          game.peeked.add(index);
          game.revealSelecting = false;
          game.revealFees += game.revealCost;
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

        game.safeOpened++;

        if (game.bonusPositions.has(index)) {
          game.currentMultiplier += normalIncrease * 2;
          game.bonusOpened++;
        } else {
          game.currentMultiplier += normalIncrease;
        }

        const safeCells = game.totalCells - game.mode.mines;

        if (game.safeOpened >= safeCells) {
          game.gameOver = true;
          game.status = 'cleared';
          game.payout = Math.max(
            0,
            Math.floor(game.amount * game.currentMultiplier) - game.revealFees
          );

          userCoins = await UserCoins.findOne({
            userId: message.author.id,
            guildId
          });

          if (userCoins) {
            userCoins.coins += game.payout;
            await userCoins.save();
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
              Math.floor(game.amount * game.currentMultiplier) -
                game.revealFees
            )
          : game.amount;

        userCoins = await UserCoins.findOne({
          userId: message.author.id,
          guildId
        });

        if (userCoins) {
          userCoins.coins += payout;
          await userCoins.save();
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
