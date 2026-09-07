const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

const UserCoins = require('../../Models/UserCoins.js');

let canvasModule = null;

function getCreateCanvas() {
  if (!canvasModule) {
    canvasModule = require('@napi-rs/canvas');
  }

  return canvasModule.createCanvas;
}

function testCanvasRenderer() {
  const createCanvas = getCreateCanvas();
  const canvas = createCanvas(2, 2);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 2, 2);

  const buffer = canvas.toBuffer('image/png');

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Canvas n\'a pas généré de PNG valide.');
  }
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
  // La croissance accélère avec le temps :
  // ~3 % au début, puis le pourcentage augmente progressivement.
  const growthPercent = Math.min(
    0.18,
    0.03 + tickCount * 0.0035
  );

  const next = current * (1 + growthPercent);

  return Number(Math.min(MAX_CRASH, next).toFixed(2));
}

function buildCrashCanvas(game) {
  const width = 900;
  const height = 420;
  const createCanvas = getCreateCanvas();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const playing = game.status === 'playing';
  const lost = game.status === 'lost';
  const cashed = game.status === 'cashed';

  const accent = lost
    ? '#ef476f'
    : cashed
      ? '#46d18c'
      : '#8b8df8';

  ctx.fillStyle = '#0f1118';
  ctx.fillRect(0, 0, width, height);

  const left = 56;
  const right = width - 36;
  const top = 36;
  const bottom = height - 52;

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 5; i++) {
    const y = top + ((bottom - top) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  for (let i = 0; i <= 8; i++) {
    const x = left + ((right - left) * i) / 8;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  const values = game.history.slice(-60);
  const maxValue = Math.max(1.2, ...values) * 1.08;
  const range = Math.max(0.2, maxValue - 1);

  const points = values.map((value, index) => {
    const x = values.length <= 1
      ? left
      : left + ((right - left) * index) / (values.length - 1);

    const normalized = Math.max(
      0,
      Math.min(1, (value - 1) / range)
    );

    const y = bottom - normalized * (bottom - top);

    return { x, y };
  });

  if (points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];

      const cx = (current.x + next.x) / 2;
      const cy = (current.y + next.y) / 2;

      ctx.quadraticCurveTo(
        current.x,
        current.y,
        cx,
        cy
      );
    }

    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
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
      lost
        ? 'rgba(239,71,111,0.30)'
        : cashed
          ? 'rgba(70,209,140,0.26)'
          : 'rgba(139,141,248,0.28)'
    );
    gradient.addColorStop(1, 'rgba(15,17,24,0)');

    ctx.lineTo(last.x, bottom);
    ctx.lineTo(points[0].x, bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  if (points.length) {
    const last = points[points.length - 1];

    ctx.beginPath();
    ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  const displayedMultiplier = lost
    ? game.crashPoint
    : cashed
      ? game.cashoutMultiplier
      : game.multiplier;

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 46px Arial';
  ctx.fillText(
    `x${displayedMultiplier.toFixed(2)}`,
    left,
    62
  );

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 18px Arial';

  const label = playing
    ? `+${Math.max(0, (displayedMultiplier - 1) * 100).toFixed(1)}%`
    : lost
      ? 'CRASH'
      : 'CASH OUT';

  ctx.fillText(label, left, 92);

  return canvas.toBuffer('image/png');
}

function buildCrashEmbed(message, game, imageName) {
  const playing = game.status === 'playing';
  const lost = game.status === 'lost';

  const displayedMultiplier = lost
    ? game.crashPoint
    : game.status === 'cashed'
      ? game.cashoutMultiplier
      : game.multiplier;

  let description = '';

  if (playing) {
    description =
      `**${formatCoins(game.amount)} coins🪙** → **${formatCoins(game.amount * game.multiplier)} coins🪙**`;
  } else if (lost) {
    description =
      `💥 **Perdu : ${formatCoins(game.amount)} coins🪙**`;
  } else {
    description =
      `✅ **+${formatCoins(game.payout)} coins🪙** à **x${displayedMultiplier.toFixed(2)}**`;
  }

  return new EmbedBuilder()
    .setDescription(description)
    .setImage(`attachment://${imageName}`)
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
}

function buildCrashRow(game) {
  if (game.status !== 'playing') return [];

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('crash_cashout')
        .setLabel(`Cash Out • x${game.multiplier.toFixed(2)}`)
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

function buildCrashPayload(message, game, frame = 0) {
  const imageName = `crash-${message.id}-${frame}.png`;

  return {
    embeds: [
      buildCrashEmbed(
        message,
        game,
        imageName
      )
    ],
    components: buildCrashRow(game),
    files: [
      new AttachmentBuilder(
        buildCrashCanvas(game),
        { name: imageName }
      )
    ],
    attachments: []
  };
}

module.exports = {
  name: 'crash',
  description: 'Misez des coins et cash out avant le crash.',

  async execute(message, args) {
    const guildId = message.guild.id;
    const amount = Number(args[0]);

    try {
      testCanvasRenderer();
    } catch (error) {
      console.error('Crash Canvas error:', error);

      return message.reply(
        '❌・Le moteur Canvas du Crash ne fonctionne pas. ' +
        'Fais **npm install** puis redémarre le bot.\n' +
        `-# ${error.message}`
      );
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return message.reply(
        '❌・Utilisation : **+crash <mise>**\nExemple : **+crash 1000**'
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

    let frame = 0;
    const gameMessage = await message.reply(
      buildCrashPayload(message, game, frame++)
    );

    let tickRunning = false;

    const collector = gameMessage.createMessageComponentCollector({
      time: 180000
    });

    const finishLoss = async () => {
      if (game.ended) return;

      game.ended = true;
      game.status = 'lost';

      clearInterval(timer);
      collector.stop('crashed');

      await gameMessage.edit(buildCrashPayload(message, game, frame++)).catch(() => {});
    };

    const timer = setInterval(async () => {
      if (game.ended || tickRunning) return;
      tickRunning = true;

      try {
        game.tickCount++;
        const nextMultiplier = getNextMultiplier(
          game.multiplier,
          game.tickCount
        );

        if (nextMultiplier >= game.crashPoint) {
          game.multiplier = game.crashPoint;
          game.history.push(game.crashPoint);
          await finishLoss();
          return;
        }

        game.multiplier = nextMultiplier;
        game.history.push(game.multiplier);

        const version = game.renderVersion;

        if (game.ended) return;

        await gameMessage.edit(
          buildCrashPayload(message, game, frame++)
        );

        // Si un Cash Out est arrivé pendant cet edit,
        // cet ancien rendu ne doit jamais rester affiché.
        if (
          game.ended ||
          version !== game.renderVersion
        ) {
          await gameMessage.edit(
            buildCrashPayload(message, game, frame++)
          ).catch(() => {});
          return;
        }
      } catch (error) {
        console.error('Crash tick error:', error);
      } finally {
        tickRunning = false;
      }
    }, TICK_MS);

    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({
          content: '❌・Cette partie ne vous appartient pas.',
          ephemeral: true
        });
      }

      if (interaction.customId !== 'crash_cashout') return;

      if (game.ended) {
        return interaction.deferUpdate().catch(() => {});
      }

      // On fige le jeu immédiatement dès le clic.
      game.ended = true;
      game.renderVersion++;
      clearInterval(timer);

      game.cashoutMultiplier = game.multiplier;
      game.payout = Math.floor(
        game.amount * game.cashoutMultiplier
      );
      game.status = 'cashed';

      collector.stop('cashed');

      // Un seul aller-retour Discord : le bouton disparaît immédiatement
      // et l'UI affiche le résultat avant la sauvegarde Mongo.
      await interaction.update(
        buildCrashPayload(message, game, frame++)
      );

      // Un tick Discord pouvait déjà être en vol au moment du clic.
      // On réaffirme l'état final juste après pour empêcher
      // tout ancien rendu de reprendre la main.
      if (tickRunning) {
        await new Promise(resolve => {
          const check = setInterval(() => {
            if (!tickRunning) {
              clearInterval(check);
              resolve();
            }
          }, 10);
        });

        await gameMessage.edit(
          buildCrashPayload(message, game, frame++)
        ).catch(() => {});
      }

      userCoins = await UserCoins.findOne({
        userId: message.author.id,
        guildId
      });

      if (userCoins) {
        userCoins.coins += game.payout;
        await userCoins.save();
      }
    });

    collector.on('end', async (_, reason) => {
      if (game.ended) return;

      if (reason === 'time') {
        await finishLoss();
      }
    });
  }
};
