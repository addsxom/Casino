const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  EmbedBuilder
} = require('discord.js');

const UserCoins = require('../../Models/UserCoins.js');

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

function buildLiveGraph(history) {
  const charWidth = 28;
  const charHeight = 8;

  // Chaque caractère braille contient une grille de 2×4 points.
  const dotWidth = charWidth * 2;
  const dotHeight = charHeight * 4;
  const values = history.slice(-dotWidth);

  const dots = Array.from(
    { length: dotHeight },
    () => Array(dotWidth).fill(false)
  );

  if (!values.length) values.push(1);

  const min = 1;
  const max = Math.max(...values, 1.15);
  const range = Math.max(0.15, max - min);

  const points = values.map((value, index) => {
    const x = values.length <= 1
      ? 0
      : Math.round(
          (index / (values.length - 1)) * (dotWidth - 1)
        );

    const normalized = Math.max(
      0,
      Math.min(1, (value - min) / range)
    );

    const y =
      dotHeight - 1 -
      Math.round(normalized * (dotHeight - 1));

    return { x, y };
  });

  const setDot = (x, y) => {
    if (
      x >= 0 &&
      y >= 0 &&
      x < dotWidth &&
      y < dotHeight
    ) {
      dots[y][x] = true;
    }
  };

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];

    const steps = Math.max(
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y),
      1
    );

    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);

      setDot(x, y);
      setDot(x, y + 1);
    }
  }

  const brailleBit = (localX, localY) => {
    const map = [
      [0x01, 0x08],
      [0x02, 0x10],
      [0x04, 0x20],
      [0x40, 0x80]
    ];

    return map[localY][localX];
  };

  const lines = [];

  for (let cy = 0; cy < charHeight; cy++) {
    let line = '';

    for (let cx = 0; cx < charWidth; cx++) {
      let mask = 0;

      for (let ly = 0; ly < 4; ly++) {
        for (let lx = 0; lx < 2; lx++) {
          const x = cx * 2 + lx;
          const y = cy * 4 + ly;

          if (dots[y][x]) {
            mask |= brailleBit(lx, ly);
          }
        }
      }

      line += String.fromCharCode(0x2800 + mask);
    }

    lines.push('│' + line + '│');
  }

  return [
    '┌' + '─'.repeat(charWidth) + '┐',
    ...lines,
    '└' + '─'.repeat(charWidth) + '┘'
  ].join('\n');
}

function buildCrashEmbed(message, game) {
  const playing = game.status === 'playing';
  const lost = game.status === 'lost';

  const displayedMultiplier = lost
    ? game.crashPoint
    : game.status === 'cashed'
      ? game.cashoutMultiplier
      : game.multiplier;

  let description =
    `# x${displayedMultiplier.toFixed(2)}\n` +
    `\`\`\`text\n${buildLiveGraph(game.history)}\n\`\`\`\n`;

  if (playing) {
    description +=
      `**${formatCoins(game.amount)} coins🪙** → **${formatCoins(game.amount * game.multiplier)} coins🪙**\n` +
      `+${Math.max(0, (displayedMultiplier - 1) * 100).toFixed(1)} %`;
  } else if (lost) {
    description +=
      `💥 **Perdu : ${formatCoins(game.amount)} coins🪙**`;
  } else {
    description +=
      `✅ **+${formatCoins(game.payout)} coins🪙**`;
  }

  return new EmbedBuilder()
    .setDescription(description)
    .setColor(
      lost
        ? 0xe91e63
        : game.status === 'cashed'
          ? 0x4caf50
          : 0x6b6de6
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

function buildCrashPayload(message, game) {
  return {
    embeds: [buildCrashEmbed(message, game)],
    components: buildCrashRow(game)
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
      tickCount: 0,
      renderVersion: 0,
      history: [1]
    };

    const gameMessage = await message.reply(buildCrashPayload(message, game));

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

      await gameMessage.edit(buildCrashPayload(message, game)).catch(() => {});
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
          buildCrashPayload(message, game)
        );

        // Si un Cash Out est arrivé pendant cet edit,
        // cet ancien rendu ne doit jamais rester affiché.
        if (
          game.ended ||
          version !== game.renderVersion
        ) {
          await gameMessage.edit(
            buildCrashPayload(message, game)
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
        buildCrashPayload(message, game)
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
          buildCrashPayload(message, game)
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
