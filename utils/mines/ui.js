const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('discord.js');

const {
  BONUS_CHANCE,
  REVEAL_COST_PERCENT,
  formatCooldown,
  getMaxBetWithReveal
} = require('./gameRules.js');
const {
  formatAmount: formatCoins
} = require('../formatAmount.js');

function buildModeContainer(message, amount) {
  const buttons =
    new ActionRowBuilder().addComponents(
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
        '\u200B\n' +
        'Choisis ton mode de jeu :'
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '⚡ **Rapide** — 3×3 • 1 mine\n' +
        '💣 **Classique** — 4×4 • 3 mines\n' +
        '🔥 **Complexe** — 5×4 • 6 mines\n' +
        '\u200B\n' +
        `🍀 **Case bonus :** ${Math.round(BONUS_CHANCE * 100)} % de chance • bonus de gain ×2 sur la case`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    )
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
    const actionRow =
      new ActionRowBuilder();

    for (
      let col = 0;
      col < mode.cols;
      col++
    ) {
      const index =
        row * mode.cols + col;
      const isClaimed =
        revealed.has(index);
      const isPeeked =
        peeked.has(index);
      const isMine =
        minePositions.has(index);
      const isBonus =
        bonusPositions.has(index);

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
          style = isClaimed
            ? ButtonStyle.Success
            : ButtonStyle.Secondary;
        } else {
          emoji = '⭐';
          style = isClaimed
            ? ButtonStyle.Success
            : ButtonStyle.Secondary;
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
        emoji = isMine
          ? '💣'
          : isBonus
            ? '🍀'
            : '⭐';
        style = ButtonStyle.Secondary;
        disabled = revealSelecting;
      }

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(
            `mines_cell_${index}`
          )
          .setEmoji(emoji)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }

    rows.push(actionRow);
  }

  if (!gameOver) {
    const hasRevealTarget =
      Array.from(
        {
          length:
            mode.rows * mode.cols
        },
        (_, i) => i
      ).some(
        i =>
          !revealed.has(i) &&
          !peeked.has(i)
      );

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mines_cashout')
          .setLabel('Cash Out')
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success)
          .setDisabled(
            safeOpened === 0 ||
            revealSelecting
          ),
        (() => {
          const remainingMs = Math.max(
            0,
            revealAvailableAt - Date.now()
          );
          const cooldownActive =
            remainingMs > 0;

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

function buildGameContainer(
  message,
  game
) {
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
    Math.floor(
      amount * currentMultiplier
    )
  );

  const remainingRevealMs = Math.max(
    0,
    revealAvailableAt - Date.now()
  );

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
      '\u200B\n' +
      '💣 mine • ⭐ vert = claim • ⭐ gris = non claim\n' +
      '🍀 vert = bonus claim • 🍀 gris = bonus non claim';
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
      'Tu as trouvé toutes les cases sûres !\n' +
      `**Gain :** ${formatCoins(payout)} coins🪙\n` +
      `**Multiplicateur final :** x${currentMultiplier.toFixed(2)}\n` +
      `**Bonus 🍀 trouvés :** ${bonusOpened}`;
    color = 0xf1c40f;
  }

  const container =
    new ContainerBuilder()
      .setAccentColor(color)
      .addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(title),
        new TextDisplayBuilder()
          .setContent(body)
      )
      .addSeparatorComponents(
        new SeparatorBuilder()
          .setDivider(true)
      );

  buildGridRows(game).forEach(
    row =>
      container.addActionRowComponents(
        row
      )
  );

  container
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        game.gameOver
          ? `-# ${message.author.tag} • Partie terminée`
          : game.revealSelecting
            ? `-# ${message.author.tag} • 🔍 Clique maintenant sur la case que tu veux Reveal`
            : allIn
              ? `-# ${message.author.tag} • Mode ALL • 🔍 Reveal indisponible`
              : `-# ${message.author.tag} • ⭐ normal • 🍀 bonus • 🔍 Reveal = ${Math.round(REVEAL_COST_PERCENT * 100)} % de la mise`
      )
    );

  return container;
}

function buildStatusContainer(
  title,
  text,
  color = 0x95a5a6
) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `# ${title}\n${text}`
      )
    );
}

function buildAllWarningContainer(
  message,
  pocketAmount
) {
  const suggestedBet =
    getMaxBetWithReveal(
      pocketAmount
    );

  const revealReserve =
    suggestedBet > 0
      ? Math.max(
          1,
          Math.ceil(
            suggestedBet *
              REVEAL_COST_PERCENT
          )
        )
      : 0;

  const buttons =
    new ActionRowBuilder().addComponents(
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
        '# ⚠️ MINES ALL\n' +
        `Tu vas miser **toute ta poche : ${formatCoins(pocketAmount)} coins🪙**.\n` +
        '\u200B\n' +
        `🔍 Un Reveal coûte **${Math.round(REVEAL_COST_PERCENT * 100)} % de la mise**. Avec **+minesall**, il ne restera aucun coin pour le payer, donc **Reveal sera désactivé pendant cette partie**.\n` +
        '\u200B\n' +
        tip
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder()
        .setDivider(true)
    )
    .addActionRowComponents(buttons)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# ${message.author.tag} • Confirme le ALL IN`
      )
    );
}

module.exports = {
  buildModeContainer,
  buildGridRows,
  buildGameContainer,
  buildStatusContainer,
  buildAllWarningContainer
};
