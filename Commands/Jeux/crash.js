const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const UserCoins = require('../../Models/UserCoins.js');

let canvasModule = null;
let gifEncoderModule = null;
let crashAnimationCache = null;

function getCreateCanvas() {
  if (!canvasModule) {
    canvasModule = require('@napi-rs/canvas');
  }

  return canvasModule.createCanvas;
}

function getGifEncoder() {
  if (!gifEncoderModule) {
    gifEncoderModule = require('gif-encoder-2');
  }

  return gifEncoderModule;
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

function buildAnimationFrames(timeline) {
  const framesPerSecond = 3;
  const frames = [];

  for (let i = 0; i < timeline.length - 1; i++) {
    const from = timeline[i];
    const to = timeline[i + 1];

    for (let step = 0; step < framesPerSecond; step++) {
      const t = step / framesPerSecond;
      const eased = t * t * (3 - 2 * t);

      frames.push(
        from + (to - from) * eased
      );
    }
  }

  frames.push(timeline[timeline.length - 1]);

  return {
    frames,
    framesPerSecond
  };
}

function drawCrashFrame(
  ctx,
  width,
  height,
  allFrames,
  frameIndex
) {
  const multiplier = allFrames[frameIndex];
  const accent = '#8b8df8';

  ctx.fillStyle = '#0f1118';
  ctx.fillRect(0, 0, width, height);

  const left = 48;
  const right = width - 28;
  const top = 30;
  const bottom = height - 42;

  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = top + ((bottom - top) * i) / 4;

    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  for (let i = 0; i <= 7; i++) {
    const x = left + ((right - left) * i) / 7;

    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  const scaleStartIndex = Math.max(
    0,
    frameIndex - 41
  );

  const currentMax = Math.max(
    1.15,
    ...allFrames.slice(
      scaleStartIndex,
      frameIndex + 1
    )
  );

  // Echelle dynamique : la courbe reste lisible dès x1.05
  // au lieu d'être écrasée par une échelle fixe jusqu'à x100.
  const maxGraphMultiplier =
    1 + (currentMax - 1) * 1.18;

  const range = Math.max(
    0.15,
    maxGraphMultiplier - 1
  );

  const progressPoints = [];

  // La courbe naît à gauche et progresse vers la droite.
  // Une fois la largeur remplie, on conserve les points les plus récents.
  const maxVisiblePoints = 42;
  const startIndex = Math.max(
    0,
    frameIndex - maxVisiblePoints + 1
  );

  const visibleCount =
    frameIndex - startIndex + 1;

  for (
    let i = startIndex;
    i <= frameIndex;
    i++
  ) {
    const localIndex =
      i - startIndex;

    const x = visibleCount <= 1
      ? left
      : left +
        ((right - left) * localIndex) /
          Math.max(
            maxVisiblePoints - 1,
            visibleCount - 1
          );

    const normalized = Math.max(
      0,
      Math.min(
        1,
        (allFrames[i] - 1) / range
      )
    );

    const y =
      bottom -
      normalized * (bottom - top);

    progressPoints.push({ x, y });
  }
  if (progressPoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(
      progressPoints[0].x,
      progressPoints[0].y
    );

    for (
      let i = 1;
      i < progressPoints.length - 1;
      i++
    ) {
      const current = progressPoints[i];
      const next = progressPoints[i + 1];

      ctx.quadraticCurveTo(
        current.x,
        current.y,
        (current.x + next.x) / 2,
        (current.y + next.y) / 2
      );
    }

    const last =
      progressPoints[progressPoints.length - 1];

    ctx.lineTo(last.x, last.y);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const gradient = ctx.createLinearGradient(
      0,
      top,
      0,
      bottom
    );

    gradient.addColorStop(
      0,
      'rgba(139,141,248,0.24)'
    );
    gradient.addColorStop(
      1,
      'rgba(15,17,24,0)'
    );

    ctx.lineTo(last.x, bottom);
    ctx.lineTo(progressPoints[0].x, bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  if (progressPoints.length) {
    const last =
      progressPoints[progressPoints.length - 1];

    ctx.beginPath();
    ctx.arc(
      last.x,
      last.y,
      7,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 42px Arial';
  ctx.fillText(
    `x${multiplier.toFixed(2)}`,
    left,
    58
  );

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 17px Arial';

  ctx.fillText(
    `+${Math.max(
      0,
      (multiplier - 1) * 100
    ).toFixed(1)}%`,
    left,
    86
  );

  // Le Canvas live reste volontairement minimal :
  // uniquement la courbe, le multiplicateur et le pourcentage.
}

function buildCrashAnimation() {
  if (crashAnimationCache) {
    return crashAnimationCache;
  }

  const createCanvas = getCreateCanvas();
  const GIFEncoder = getGifEncoder();

  const width = 500;
  const height = 220;

  const timeline = buildRoundTimeline();

  const {
    frames,
    framesPerSecond
  } = buildAnimationFrames(timeline);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const encoder = new GIFEncoder(
    width,
    height,
    'neuquant',
    true,
    frames.length
  );

  encoder.start();
  encoder.setDelay(
    Math.round(1000 / framesPerSecond)
  );
  encoder.setQuality(30);

  for (let i = 0; i < frames.length; i++) {
    drawCrashFrame(
      ctx,
      width,
      height,
      frames,
      i
    );

    encoder.addFrame(ctx);
  }

  encoder.finish();

  crashAnimationCache = encoder.out.getData();

  return crashAnimationCache;
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
      `**Mise :** ${formatCoins(game.amount)} coins🪙\n` +
      `Le multiplicateur et le gain sont affichés en direct sur le graphique.`;
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

  if (showAnimation) {
    embed.setImage('attachment://crash-animation.gif');
  }

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
  return {
    ...buildCrashPayload(
      message,
      game,
      true
    ),
    files: [
      new AttachmentBuilder(
        buildCrashAnimation(),
        {
          name: 'crash-animation.gif'
        }
      )
    ]
  };
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
      tickCount: 0,
      renderVersion: 0,
      history: [1]
    };

    let gameMessage;

    try {
      // Réponse immédiate : l'utilisateur voit la commande sans attendre l'encodage.
      gameMessage = await message.reply(
        '🎰・Préparation du Crash...'
      );

      await gameMessage.edit(
        buildInitialCrashPayload(
          message,
          game
        )
      );
    } catch (error) {
      console.error(
        'Crash animation error:',
        error
      );

      userCoins.coins += amount;
      await userCoins.save();

      if (gameMessage) {
        return gameMessage.edit(
          '❌・Impossible de générer l\'animation du Crash. ' +
          'Fais **npm install** puis redémarre le bot.'
        );
      }

      return message.reply(
        '❌・Impossible de générer l\'animation du Crash.'
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

      // Une seule modification à la fin : on retire le GIF
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
        game.cashoutLocked
      ) return;

      try {
        game.tickCount++;

        const nextMultiplier =
          getNextMultiplier(
            game.multiplier,
            game.tickCount
          );

        if (
          nextMultiplier >=
          game.crashPoint
        ) {
          game.multiplier =
            game.crashPoint;

          game.history.push(
            game.crashPoint
          );

          await finishLoss();
          return;
        }

        game.multiplier =
          nextMultiplier;

        game.history.push(
          game.multiplier
        );

        // Aucun edit Discord pendant la montée.
        // Le GIF Canvas est l'unique affichage live.
      } catch (error) {
        console.error(
          'Crash tick error:',
          error
        );
      }
    }, TICK_MS);

    collector.on(
      'collect',
      async interaction => {
        if (
          interaction.customId !==
          'crash_cashout'
        ) {
          return;
        }

        // On envoie l'ACK à Discord dès l'arrivée du clic.
        // La requête part avant les calculs, le stop du collector
        // et la génération du Canvas final.
        const ackPromise =
          interaction.deferUpdate().catch(
            error => {
              console.error(
                'Crash cashout ACK error:',
                error
              );
              return null;
            }
          );

        if (
          interaction.user.id !==
          message.author.id
        ) {
          await ackPromise;
          return;
        }

        if (
          game.ended ||
          game.cashoutLocked
        ) {
          await ackPromise;
          return;
        }

        // Verrouillage synchrone immédiat.
        game.cashoutLocked = true;

        const lockedMultiplier =
          game.multiplier;

        clearInterval(timer);

        game.ended = true;
        game.cashoutMultiplier =
          lockedMultiplier;

        game.payout = Math.floor(
          game.amount *
          lockedMultiplier
        );

        game.status = 'cashed';

        collector.stop('cashed');

        // On attend seulement maintenant la confirmation Discord.
        const acknowledged =
          await ackPromise;

        // Même si Discord refuse exceptionnellement l'ACK,
        // la partie reste figée et le paiement est conservé.
        await gameMessage.edit(
          buildInstantResultPayload(
            message,
            game
          )
        ).catch(() => {});

        await gameMessage.edit(
          buildResultPayload(
            message,
            game
          )
        ).catch(() => {});

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
