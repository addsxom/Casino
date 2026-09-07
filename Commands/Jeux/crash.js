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
  const width = 26;
  const height = 7;
  const values = history.slice(-width);

  const emptyGraph = [
    '┌' + '─'.repeat(width) + '┐',
    ...Array.from(
      { length: height },
      () => '│' + ' '.repeat(width) + '│'
    ),
    '└' + '─'.repeat(width) + '┘'
  ].join('\n');

  if (!values.length) return emptyGraph;

  const min = 1;
  const max = Math.max(...values, 1.2);
  const range = Math.max(0.2, max - min);

  const grid = Array.from(
    { length: height },
    () => Array(width).fill(' ')
  );

  const points = values.map((value, index) => {
    const x = index;
    const normalized = Math.max(
      0,
      Math.min(1, (value - min) / range)
    );
    const y =
      height - 1 - Math.round(normalized * (height - 1));

    return { x, y };
  });

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];

    let x = previous.x;
    let y = previous.y;

    while (x < current.x) {
      x++;

      if (y > current.y) {
        y--;
        grid[y][x] = '╱';
      } else if (y < current.y) {
        y++;
        grid[y][x] = '╲';
      } else {
        grid[y][x] = '─';
      }
    }
  }

  points.forEach((point, index) => {
    if (
      point.x >= 0 &&
      point.x < width &&
      point.y >= 0 &&
      point.y < height
    ) {
      grid[point.y][point.x] =
        index === points.length - 1 ? '●' : '•';
    }
  });

  return [
    '┌' + '─'.repeat(width) + '┐',
    ...grid.map(row => '│' + row.join('') + '│'),
    '└' + '─'.repeat(width) + '┘'
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
    `## x${displayedMultiplier.toFixed(2)}\n` +
    `\`\`\`text\n${buildLiveGraph(game.history)}\n\`\`\`\n` +
    `**Mise :** ${formatCoins(game.amount)} coins🪙\n`;

  if (playing) {
    description += `**Gain actuel :** ${formatCoins(game.amount * game.multiplier)} coins🪙\n\nCash Out avant le crash.`;
  } else if (lost) {
    description += `\n💥 Crash à **x${game.crashPoint.toFixed(2)}**\nTu as perdu **${formatCoins(game.amount)} coins🪙**.`;
  } else {
    description += `\n✅ Cash Out à **x${game.cashoutMultiplier.toFixed(2)}**\n**Gain :** ${formatCoins(game.payout)} coins🪙`;
  }

  const embed = new EmbedBuilder()
    .setTitle(lost ? '💥 CRASH !' : game.status === 'cashed' ? '💰 CASH OUT' : '🚀 CRASH')
    .setDescription(description)
    .setColor(lost ? 0xe91e63 : game.status === 'cashed' ? 0x4caf50 : 0x6b6de6)
    .setFooter({ text: `${message.author.tag} • ${playing ? 'Clique avant le crash' : 'Partie terminée'}` });

  return embed;
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

        if (version !== game.renderVersion) return;
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
