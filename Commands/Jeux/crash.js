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

function buildRoundTimeline(crashPoint) {
  const values = [1];
  let multiplier = 1;
  let tickCount = 0;

  while (multiplier < crashPoint && tickCount < 180) {
    tickCount++;

    const next = getNextMultiplier(
      multiplier,
      tickCount
    );

    if (next >= crashPoint) {
      values.push(crashPoint);
      break;
    }

    multiplier = next;
    values.push(multiplier);
  }

  return values;
}

function buildAnimationFrames(timeline) {
  const framesPerSecond = 5;
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
  frameIndex,
  crashPoint
) {
  const isCrash = frameIndex === allFrames.length - 1;
  const multiplier = allFrames[frameIndex];

  const accent = isCrash
    ? '#ef476f'
    : '#8b8df8';

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

  const maxGraphMultiplier = Math.max(
    1.2,
    crashPoint * 1.08
  );
  const range = Math.max(
    0.2,
    maxGraphMultiplier - 1
  );

  const progressPoints = [];

  for (let i = 0; i <= frameIndex; i++) {
    const x = allFrames.length <= 1
      ? left
      : left +
        ((right - left) * i) /
          (allFrames.length - 1);

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
      isCrash
        ? 'rgba(239,71,111,0.25)'
        : 'rgba(139,141,248,0.24)'
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
      isCrash ? 10 : 7,
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

  ctx.fillStyle = isCrash
    ? '#ef476f'
    : 'rgba(255,255,255,0.55)';
  ctx.font = '600 17px Arial';

  ctx.fillText(
    isCrash
      ? 'CRASH'
      : `+${Math.max(
          0,
          (multiplier - 1) * 100
        ).toFixed(1)}%`,
    left,
    86
  );
}

function buildCrashAnimation(crashPoint) {
  const createCanvas = getCreateCanvas();
  const GIFEncoder = getGifEncoder();

  const width = 680;
  const height = 300;

  const timeline =
    buildRoundTimeline(crashPoint);

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
  encoder.setQuality(12);

  for (let i = 0; i < frames.length; i++) {
    drawCrashFrame(
      ctx,
      width,
      height,
      frames,
      i,
      crashPoint
    );

    encoder.addFrame(ctx);
  }

  encoder.finish();

  return encoder.out.getData();
}

function buildAnimationEmbed() {
  return new EmbedBuilder()
    .setImage('attachment://crash-animation.gif')
    .setColor(0x8b8df8);
}

function buildCrashEmbed(
  message,
  game
) {
  const playing = game.status === 'playing';
  const lost = game.status === 'lost';

  const displayedMultiplier = lost
    ? game.crashPoint
    : game.status === 'cashed'
      ? game.cashoutMultiplier
      : game.multiplier;

  let description =
    `# x${displayedMultiplier.toFixed(2)}\n`;

  if (playing) {
    description +=
      `**${formatCoins(game.amount)} coins🪙** → **${formatCoins(game.amount * game.multiplier)} coins🪙**\n` +
      `+${Math.max(
        0,
        (displayedMultiplier - 1) * 100
      ).toFixed(1)} %`;
  } else if (lost) {
    description +=
      `💥 **Perdu : ${formatCoins(game.amount)} coins🪙**`;
  } else {
    description +=
      `✅ **+${formatCoins(game.payout)} coins🪙** à **x${displayedMultiplier.toFixed(2)}**`;
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
        .setLabel(
          `Cash Out • x${game.multiplier.toFixed(2)}`
        )
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildCrashPayload(
  message,
  game
) {
  return {
    embeds: [
      buildCrashEmbed(
        message,
        game
      )
    ],
    components: buildCrashRow(game)
  };
}

function buildInitialCrashPayload(game) {
  return {
    embeds: [buildAnimationEmbed()],
    files: [
      new AttachmentBuilder(
        buildCrashAnimation(
          game.crashPoint
        ),
        {
          name: 'crash-animation.gif'
        }
      )
    ]
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
      tickCount: 0,
      renderVersion: 0,
      history: [1]
    };

    let animationMessage;
    let controlMessage;

    try {
      animationMessage = await message.reply(
        buildInitialCrashPayload(game)
      );

      controlMessage = await message.channel.send(
        buildCrashPayload(
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

      return message.reply(
        '❌・Impossible de générer l\'animation du Crash. ' +
        'Fais **npm install** puis redémarre le bot.'
      );
    }

    let tickRunning = false;

    const collector =
      controlMessage.createMessageComponentCollector({
        time: 180000
      });

    const finishLoss = async () => {
      if (game.ended) return;

      game.ended = true;
      game.status = 'lost';

      clearInterval(timer);
      collector.stop('crashed');

      await controlMessage.edit(
        buildCrashPayload(
          message,
          game
        )
      ).catch(() => {});
    };

    const timer = setInterval(async () => {
      if (
        game.ended ||
        tickRunning
      ) {
        return;
      }

      tickRunning = true;

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

        const version =
          game.renderVersion;

        if (game.ended) return;

        await controlMessage.edit(
          buildCrashPayload(
            message,
            game
          )
        );

        if (
          game.ended ||
          version !==
            game.renderVersion
        ) {
          return;
        }
      } catch (error) {
        console.error(
          'Crash tick error:',
          error
        );
      } finally {
        tickRunning = false;
      }
    }, TICK_MS);

    collector.on(
      'collect',
      async interaction => {
        if (
          interaction.user.id !==
          message.author.id
        ) {
          return interaction.reply({
            content:
              '❌・Cette partie ne vous appartient pas.',
            ephemeral: true
          });
        }

        if (
          interaction.customId !==
          'crash_cashout'
        ) {
          return;
        }

        if (game.ended) {
          return interaction
            .deferUpdate()
            .catch(() => {});
        }

        game.ended = true;
        game.renderVersion++;

        clearInterval(timer);

        game.cashoutMultiplier =
          game.multiplier;

        game.payout = Math.floor(
          game.amount *
          game.cashoutMultiplier
        );

        game.status = 'cashed';

        collector.stop('cashed');

        // Le GIF est dans un autre message et n'est jamais édité.
        // Seul le panneau de contrôle est figé au Cash Out.
        await interaction.update(
          buildCrashPayload(
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
