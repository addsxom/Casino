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
  const width = 30;
  const height = 7;
  const values = history.slice(-width);

  if (!values.length) values.push(1);

  const min = 1;
  const max = Math.max(...values, 1.15);
  const range = Math.max(0.15, max - min);

  const grid = Array.from(
    { length: height },
    () => Array(width).fill('·')
  );

  const points = values.map((value, index) => {
    const x = values.length <= 1
      ? 0
      : Math.round(
          (index / (values.length - 1)) * (width - 1)
        );

    const normalized = Math.max(
      0,
      Math.min(1, (value - min) / range)
    );

    const y =
      height - 1 -
      Math.round(normalized * (height - 1));

    return { x, y };
  });

  const drawPoint = (x, y, char) => {
    if (
      x >= 0 &&
      y >= 0 &&
      x < width &&
      y < height
    ) {
      grid[y][x] = char;
    }
  };

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];

    const steps = Math.max(
      Math.abs(to.x - from.x),
      Math.abs(to.y - from.y),
      1
    );

    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const x = Math.round(
        from.x + (to.x - from.x) * t
      );
      const y = Math.round(
        from.y + (to.y - from.y) * t
      );

      let char = '─';

      if (to.y < from.y) char = '╱';
      if (to.y > from.y) char = '╲';

      drawPoint(x, y, char);
    }
  }

  const last = points[points.length - 1];
  drawPoint(last.x, last.y, '●');

  return grid
    .map(row => row.join(''))
    .join('\n');
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
