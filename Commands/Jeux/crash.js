const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const UserCoins = require('../../Models/UserCoins.js');

let canvasModule = null;
const LIVE_UPDATE_MS = 700;

function getCreateCanvas() {
  if (!canvasModule) {
    canvasModule = require('@napi-rs/canvas');
  }

  return canvasModule.createCanvas;
}

const HOUSE_EDGE = 0.03;
const MAX_CRASH = 100;
const TICK_MS = 1000;

function formatCoins(amount) {
  return Math.floor(amount).toLocaleString('fr-FR');
}

function generateCrashPoint() {
  const random = Math.random();
  const raw = (1 - HOUSE_EDGE) / (1 - random);
  const point = Math.floor(raw * 100) / 100;

  return Math.min(MAX_CRASH, Math.max(1, point));
}

function getNextMultiplier(current, tickCount) {
  const growthPercent = Math.min(
    0.18,
    0.03 + tickCount * 0.0035
  );

  const next = current * (1 + growthPercent);

  return Number(Math.min(MAX_CRASH, next).toFixed(2));
}

function buildRoundTimeline() {
  const values = [1];
  let multiplier = 1;
  let tickCount = 0;

  while (multiplier < MAX_CRASH && tickCount < 180) {
    tickCount++;

    multiplier = getNextMultiplier(
      multiplier,
      tickCount
    );

    values.push(multiplier);

    if (multiplier >= MAX_CRASH) {
      break;
    }
  }

  return values;
}

function getVisualMultiplierAt(
  startedAt,
  timestamp = Date.now()
) {
  const timeline = buildRoundTimeline();
  const elapsed = Math.max(
    0,
    timestamp - startedAt
  );

  const segmentIndex = Math.min(
    timeline.length - 2,
    Math.floor(elapsed / TICK_MS)
  );

  if (elapsed >= (timeline.length - 1) * TICK_MS) {
    return timeline[timeline.length - 1];
  }

  const localT =
    (elapsed % TICK_MS) / TICK_MS;

  const eased =
    localT * localT * (3 - 2 * localT);

  const from = timeline[segmentIndex];
  const to = timeline[segmentIndex + 1];

  return Number(
    (from + (to - from) * eased).toFixed(2)
  );
}

function buildTextGraph(game) {
  const width = 28;
  const height = 8;
  const values =
    game.history.slice(-width);

  const maxValue = Math.max(
    1.15,
    ...values
  );

  const range = Math.max(
    0.15,
    maxValue - 1
  );

  const grid = Array.from(
    { length: height },
    () => Array(width).fill(' ')
  );

  values.forEach((value, index) => {
    const normalized = Math.max(
      0,
      Math.min(
        1,
        (value - 1) / range
      )
    );

    const row =
      height -
      1 -
      Math.round(
        normalized * (height - 1)
      );

    grid[row][index] = '●';

    // Relie visuellement les points quand la courbe monte.
    if (index > 0) {
      const previous = values[index - 1];
      const previousNormalized = Math.max(
        0,
        Math.min(
          1,
          (previous - 1) / range
        )
      );

      const previousRow =
        height -
        1 -
        Math.round(
          previousNormalized * (height - 1)
        );

      const minRow = Math.min(
        row,
        previousRow
      );
      const maxRow = Math.max(
        row,
        previousRow
      );

      for (
        let r = minRow + 1;
        r < maxRow;
        r++
      ) {
        if (grid[r][index] === ' ') {
          grid[r][index] = '│';
        }
      }
    }
  });

  return grid
    .map(row => row.join(''))
    .join('\n');
}

function buildResultCanvas(game) {
  const createCanvas = getCreateCanvas();
  const width = 700;
  const height = 300;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const won = game.status === 'cashed';
  const accent = won
    ? '#46d18c'
    : '#ef476f';

  ctx.fillStyle = '#0f1118';
  ctx.fillRect(0, 0, width, height);

  const left = 34;
  const right = width - 32;
  const top = 34;
  const bottom = height - 34;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y =
      top +
      ((bottom - top) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  for (let i = 0; i <= 7; i++) {
    const x =
      left +
      ((right - left) * i) / 7;

    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  const values = game.history.length
    ? game.history
    : [1];

  const maxValue = Math.max(
    1.1,
    ...values
  );

  const range = Math.max(
    0.1,
    maxValue - 1
  );

  const points = values.map(
    (value, index) => {
      const x = values.length <= 1
        ? left
        : left +
          ((right - left) * index) /
            (values.length - 1);

      const normalized = Math.max(
        0,
        Math.min(
          1,
          (value - 1) / range
        )
      );

      const y =
        bottom -
        normalized * (bottom - top);

      return { x, y };
    }
  );

  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(
      points[0].x,
      points[0].y
    );

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(
        points[i].x,
        points[i].y
      );
    }

    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const last =
      points[points.length - 1];

    const gradient =
      ctx.createLinearGradient(
        0,
        top,
        0,
        bottom
      );

    gradient.addColorStop(
      0,
      won
        ? 'rgba(70,209,140,0.22)'
        : 'rgba(239,71,111,0.24)'
    );
    gradient.addColorStop(
      1,
      'rgba(15,17,24,0)'
    );

    ctx.lineTo(last.x, bottom);
    ctx.lineTo(points[0].x, bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  const last = points[points.length - 1];

  ctx.beginPath();
  ctx.arc(
    last.x,
    last.y,
    8,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Seulement l'état final sur le Canvas.
  // Les détails chiffrés restent dans l'embed.
  ctx.fillStyle = accent;
  ctx.font = '700 28px Arial';
  ctx.fillText(
    won ? 'CASH OUT' : 'CRASH',
    left,
    top + 30
  );

  return canvas.toBuffer('image/png');
}

function buildGameEmbed(message, game, showAnimation = true) {
  const playing = game.status === 'playing';
  const lost = game.status === 'lost';

  let description;

  if (playing) {
    description =
      `**x${game.multiplier.toFixed(2)}**  •  ` +
      `**${formatCoins(game.amount * game.multiplier)} coins🪙**\n` +
      `Mise : ${formatCoins(game.amount)} coins🪙\n\n` +
      `\`\`\`\n${buildTextGraph(game)}\n\`\`\``;
  } else if (lost) {
    description =
      `💥 **Crash à x${game.crashPoint.toFixed(2)}**\n` +
      `**Mise :** ${formatCoins(game.amount)} coins🪙\n` +
      `**Perte :** -${formatCoins(game.amount)} coins🪙`;
  } else {
    description =
      `✅ **Cash Out à x${game.cashoutMultiplier.toFixed(2)}**\n` +
      `**Mise :** ${formatCoins(game.amount)} coins🪙\n` +
      `**Gain :** +${formatCoins(game.payout)} coins🪙`;
  }

  const embed = new EmbedBuilder()
    .setDescription(description)
    .setColor(
      lost
        ? 0xef476f
        : game.status === 'cashed'
          ? 0x46d18c
          : 0x8b8df8
    )
    .setFooter({
      text: playing
        ? message.author.tag
        : `${message.author.tag} • Terminé`
    });

  return embed;
}


function buildCrashRow(game) {
  if (game.status !== 'playing') return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('crash_cashout')
        .setLabel('Cash Out')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildCrashPayload(
  message,
  game,
  showAnimation = true
) {
  return {
    embeds: [
      buildGameEmbed(
        message,
        game,
        showAnimation
      )
    ],
    components: buildCrashRow(game)
  };
}

function buildInitialCrashPayload(
  message,
  game
) {
  return buildCrashPayload(
    message,
    game,
    false
  );
}

function buildLiveCrashPayload(
  message,
  game
) {
  return buildCrashPayload(
    message,
    game,
    false
  );
}

function buildInstantResultPayload(
  message,
  game
) {
  return {
    embeds: [
      buildGameEmbed(
        message,
        game,
        false
      )
    ],
    components: [],
    attachments: []
  };
}

function buildResultPayload(
  message,
  game
) {
  return {
    embeds: [
      buildGameEmbed(
        message,
        game,
        false
      ).setImage(
        'attachment://crash-result.png'
      )
    ],
    components: [],
    files: [
      new AttachmentBuilder(
        buildResultCanvas(game),
        {
          name: 'crash-result.png'
        }
      )
    ],
    attachments: []
  };
}


module.exports = {
  name: 'crash',
  description:
    'Misez des coins et cash out avant le crash.',

  async execute(message, args) {
    const guildId = message.guild.id;
    const amount = Number(args[0]);

    if (
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return message.reply(
        '❌・Utilisation : **+crash <mise>**\n' +
        'Exemple : **+crash 1000**'
      );
    }

    let userCoins =
      await UserCoins.findOne({
        userId: message.author.id,
        guildId
      });

    if (
      !userCoins ||
      userCoins.coins < amount
    ) {
      return message.reply(
        '❌・Vous n\'avez pas assez de coins pour cette mise.'
      );
    }

    userCoins.coins -= amount;
    await userCoins.save();

    const game = {
      amount,
      multiplier: 1,
      crashPoint: generateCrashPoint(),
      cashoutMultiplier: 0,
      payout: 0,
      status: 'playing',
      ended: false,
      cashoutLocked: false,
      startedAt: null,
      tickCount: 0,
      renderVersion: 0,
      history: [1]
    };

    let gameMessage;

    try {
      gameMessage = await message.reply(
        buildInitialCrashPayload(
          message,
          game
        )
      );

      // Référence temporelle commune à l'affichage live et à la logique du jeu.
      game.startedAt = Date.now();
    } catch (error) {
      console.error(
        'Crash display error:',
        error
      );

      userCoins.coins += amount;
      await userCoins.save();

      if (gameMessage) {
        return gameMessage.edit(
          '❌・Impossible d\'afficher le Crash.'
        );
      }

      return message.reply(
        '❌・Impossible d\'afficher le Crash.'
      );
    }

    const collector =
      gameMessage.createMessageComponentCollector({
        time: 180000
      });

    const finishLoss = async () => {
      if (
        game.ended ||
        game.cashoutLocked
      ) return;

      game.ended = true;
      game.status = 'lost';

      clearInterval(timer);
      collector.stop('crashed');

      // Une seule modification à la fin : on retire le Canvas live
      // et on affiche clairement la perte.
      await gameMessage.edit(
        buildResultPayload(
          message,
          game
        )
      ).catch(() => {});
    };

    const timer = setInterval(async () => {
      if (
        game.ended ||
        game.cashoutLocked ||
        !game.startedAt
      ) return;

      try {
        const visualMultiplier =
          getVisualMultiplierAt(
            game.startedAt
          );

        if (
          visualMultiplier <=
          game.multiplier
        ) {
          return;
        }

        game.multiplier =
          visualMultiplier;

        game.history.push(
          game.multiplier
        );

        if (
          game.multiplier >=
          game.crashPoint
        ) {
          game.multiplier =
            game.crashPoint;

          game.history[
            game.history.length - 1
          ] = game.crashPoint;

          await finishLoss();
          return;
        }

        await gameMessage.edit(
          buildLiveCrashPayload(
            message,
            game
          )
        ).catch(() => {});
      } catch (error) {
        console.error(
          'Crash tick error:',
          error
        );
      }
    }, LIVE_UPDATE_MS);
    collector.on(
      'collect',
      async interaction => {
        const clickedAt = Date.now();

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
            content:
              '❌・Cette partie ne vous appartient pas.',
            ephemeral: true
          }).catch(() => {});
        }

        if (
          game.ended ||
          game.cashoutLocked ||
          !game.startedAt
        ) {
          return interaction.reply({
            content:
              '💥・Cette partie est déjà terminée.',
            ephemeral: true
          }).catch(() => {});
        }

        // Le clic devient immédiatement la source de vérité.
        game.cashoutLocked = true;
        clearInterval(timer);

        const lockedMultiplier =
          getVisualMultiplierAt(
            game.startedAt,
            clickedAt
          );

        if (
          lockedMultiplier >=
          game.crashPoint
        ) {
          game.multiplier =
            game.crashPoint;

          game.history.push(
            game.crashPoint
          );

          game.cashoutLocked = false;

          await interaction.deferUpdate()
            .catch(() => {});

          await finishLoss();
          return;
        }

        game.ended = true;
        game.multiplier =
          lockedMultiplier;
        game.cashoutMultiplier =
          lockedMultiplier;

        if (
          game.history[
            game.history.length - 1
          ] !== lockedMultiplier
        ) {
          game.history.push(
            lockedMultiplier
          );
        }

        game.payout = Math.floor(
          game.amount *
          lockedMultiplier
        );

        game.status = 'cashed';

        collector.stop('cashed');

        // Confirmation visuelle immédiate : aucune image à générer ici.
        await interaction.update(
          buildInstantResultPayload(
            message,
            game
          )
        );

        userCoins =
          await UserCoins.findOne({
            userId: message.author.id,
            guildId
          });

        if (userCoins) {
          userCoins.coins +=
            game.payout;

          await userCoins.save();
        }

        // Finition uniquement après le Cash Out confirmé.
        await gameMessage.edit(
          buildResultPayload(
            message,
            game
          )
        ).catch(() => {});
      }
    );
    collector.on(
      'end',
      async (_, reason) => {
        if (game.ended) return;

        if (reason === 'time') {
          await finishLoss();
        }
      }
    );
  }
};
