const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
  AttachmentBuilder,
  EmbedBuilder
} = require('discord.js');

const UserCoins = require('../../Models/UserCoins.js');
const { PNG } = require('pngjs');

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

function getNextMultiplier(current) {
  let increase = 0.05;

  if (current >= 2) increase = 0.08;
  if (current >= 5) increase = 0.15;
  if (current >= 10) increase = 0.30;
  if (current >= 25) increase = 0.60;
  if (current >= 50) increase = 1.00;

  return Number((current + increase).toFixed(2));
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function drawLine(png, x0, y0, x1, y1, r, g, b, thickness = 2) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    for (let ox = -thickness; ox <= thickness; ox++) {
      for (let oy = -thickness; oy <= thickness; oy++) {
        if (ox * ox + oy * oy <= thickness * thickness) {
          setPixel(png, x0 + ox, y0 + oy, r, g, b);
        }
      }
    }

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function createCrashGraph(game) {
  const width = 900;
  const height = 430;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = 17;
      png.data[idx + 1] = 19;
      png.data[idx + 2] = 28;
      png.data[idx + 3] = 255;
    }
  }

  const left = 55;
  const right = width - 35;
  const top = 30;
  const bottom = height - 45;

  for (let i = 0; i <= 5; i++) {
    const y = Math.round(top + ((bottom - top) * i) / 5);
    drawLine(png, left, y, right, y, 45, 48, 62, 1);
  }

  for (let i = 0; i <= 8; i++) {
    const x = Math.round(left + ((right - left) * i) / 8);
    drawLine(png, x, top, x, bottom, 38, 41, 54, 1);
  }

  drawLine(png, left, top, left, bottom, 105, 109, 130, 1);
  drawLine(png, left, bottom, right, bottom, 105, 109, 130, 1);

  const values = game.history.slice(-70);
  const maxValue = Math.max(1.25, ...values) * 1.08;
  const range = Math.max(0.25, maxValue - 1);

  const points = values.map((value, index) => {
    const x = values.length <= 1
      ? left
      : left + ((right - left) * index) / (values.length - 1);
    const normalized = Math.max(0, Math.min(1, (value - 1) / range));
    const y = bottom - normalized * (bottom - top);
    return { x: Math.round(x), y: Math.round(y) };
  });

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    drawLine(png, prev.x, prev.y, cur.x, cur.y, 107, 109, 230, 5);
    drawLine(png, prev.x, prev.y, cur.x, cur.y, 188, 190, 255, 2);
  }

  if (points.length) {
    const p = points[points.length - 1];
    const pointColor = game.status === 'lost'
      ? [233, 30, 99]
      : game.status === 'cashed'
        ? [76, 175, 80]
        : [255, 255, 255];

    for (let ox = -8; ox <= 8; ox++) {
      for (let oy = -8; oy <= 8; oy++) {
        if (ox * ox + oy * oy <= 64) {
          setPixel(png, p.x + ox, p.y + oy, pointColor[0], pointColor[1], pointColor[2]);
        }
      }
    }
  }

  return PNG.sync.write(png);
}

function buildCrashEmbed(message, game, imageName) {
  const playing = game.status === 'playing';
  const lost = game.status === 'lost';
  const displayedMultiplier = lost
    ? game.crashPoint
    : game.status === 'cashed'
      ? game.cashoutMultiplier
      : game.multiplier;

  let description =
    `**Mise :** ${formatCoins(game.amount)} coins🪙\n` +
    `**Multiplicateur :** x${displayedMultiplier.toFixed(2)}\n`;

  if (playing) {
    description += `**Gain actuel :** ${formatCoins(game.amount * game.multiplier)} coins🪙\n\nCash Out avant le crash.`;
  } else if (lost) {
    description += `\n💥 Crash à **x${game.crashPoint.toFixed(2)}**\nTu as perdu **${formatCoins(game.amount)} coins🪙**.`;
  } else {
    description += `\n✅ Cash Out à **x${game.cashoutMultiplier.toFixed(2)}**\n**Gain :** ${formatCoins(game.payout)} coins🪙`;
  }

  return new EmbedBuilder()
    .setTitle(lost ? '💥 CRASH !' : game.status === 'cashed' ? '💰 CASH OUT' : '🚀 CRASH')
    .setDescription(description)
    .setImage(`attachment://${imageName}`)
    .setColor(lost ? 0xe91e63 : game.status === 'cashed' ? 0x4caf50 : 0x6b6de6)
    .setFooter({ text: `${message.author.tag} • ${playing ? 'Clique avant le crash' : 'Partie terminée'}` });
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

function buildCrashPayload(message, game, frame) {
  const imageName = `crash-${message.id}-${frame}.png`;
  const attachment = new AttachmentBuilder(createCrashGraph(game), { name: imageName });

  return {
    embeds: [buildCrashEmbed(message, game, imageName)],
    components: buildCrashRow(game),
    files: [attachment],
    attachments: []
  };
}

module.exports = {
  name: 'crash',
  description: 'Misez des coins et cash out avant le crash.',

  async execute(message, args) {
    const guildId = message.guild.id;
    const amount = Number(args[0]);

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
      history: [1]
    };

    let frame = 0;
    const gameMessage = await message.reply(buildCrashPayload(message, game, frame++));

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
        const nextMultiplier = getNextMultiplier(game.multiplier);

        if (nextMultiplier >= game.crashPoint) {
          game.multiplier = game.crashPoint;
          game.history.push(game.crashPoint);
          await finishLoss();
          return;
        }

        game.multiplier = nextMultiplier;
        game.history.push(game.multiplier);

        await gameMessage.edit(buildCrashPayload(message, game, frame++));
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

      await interaction.deferUpdate();

      if (game.ended) return;

      game.ended = true;
      clearInterval(timer);

      game.cashoutMultiplier = game.multiplier;
      game.payout = Math.floor(game.amount * game.cashoutMultiplier);
      game.status = 'cashed';

      userCoins = await UserCoins.findOne({
        userId: message.author.id,
        guildId
      });

      if (userCoins) {
        userCoins.coins += game.payout;
        await userCoins.save();
      }

      collector.stop('cashed');

      await gameMessage.edit(buildCrashPayload(message, game, frame++)).catch(() => {});
    });

    collector.on('end', async (_, reason) => {
      if (game.ended) return;

      if (reason === 'time') {
        await finishLoss();
      }
    });
  }
};
