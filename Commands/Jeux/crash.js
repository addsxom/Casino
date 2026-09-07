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

function buildCrashGraph(history, status) {
  const width = 24;
  const height = 8;
  const values = history.slice(-width);

  if (values.length === 0) values.push(1);

  const min = 1;
  const max = Math.max(...values, 1.25);
  const range = Math.max(0.25, max - min);

  const grid = Array.from(
    { length: height },
    () => Array(width).fill(' ')
  );

  values.forEach((value, x) => {
    const normalized = Math.max(0, Math.min(1, (value - min) / range));
    const y = height - 1 - Math.round(normalized * (height - 1));

    grid[y][x] = status === 'lost' && x === values.length - 1 ? '✕' : '●';

    if (x > 0) {
      const previous = values[x - 1];
      const previousNormalized = Math.max(0, Math.min(1, (previous - min) / range));
      const previousY = height - 1 - Math.round(previousNormalized * (height - 1));
      const from = Math.min(previousY, y);
      const to = Math.max(previousY, y);

      for (let row = from; row <= to; row++) {
        if (grid[row][x] === ' ') grid[row][x] = '│';
      }
    }
  });

  const lines = grid.map(row => '│ ' + row.join(''));
  lines.push('└' + '─'.repeat(width + 1));

  return '```text\n' + lines.join('\n') + '\n```';
}
function buildCrashContainer(message, game) {
  let title = '# 🚀 CRASH';
  let color = 0x6b6de6;
  const graph = buildCrashGraph(game.history, game.status);
  let body =
    `## x${game.multiplier.toFixed(2)}\n` +
    graph + '\n' +
    `**Mise :** ${formatCoins(game.amount)} coins🪙\n` +
    `**Gain actuel :** ${formatCoins(game.amount * game.multiplier)} coins🪙\n` +
    `\u200B\n` +
    `Cash Out avant le crash.`;

  if (game.status === 'lost') {
    title = '# 💥 CRASH !';
    color = 0xe91e63;
    body =
      `## x${game.crashPoint.toFixed(2)} 💥\n` +
      graph + '\n' +
      `Le jeu a crash à **x${game.crashPoint.toFixed(2)}**.\n` +
      `Tu as perdu **${formatCoins(game.amount)} coins🪙**.`;
  }

  if (game.status === 'cashed') {
    title = '# 💰 CASH OUT';
    color = 0x4caf50;
    body =
      `## x${game.cashoutMultiplier.toFixed(2)} ✅\n` +
      graph + '\n' +
      `Tu as encaissé à **x${game.cashoutMultiplier.toFixed(2)}**.\n` +
      `**Gain :** ${formatCoins(game.payout)} coins🪙`;
  }

  const container = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(title),
      new TextDisplayBuilder().setContent(body)
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true)
    );

  if (game.status === 'playing') {
    container.addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('crash_cashout')
          .setLabel(`Cash Out • x${game.multiplier.toFixed(2)}`)
          .setEmoji('💰')
          .setStyle(ButtonStyle.Success)
      )
    );
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      game.status === 'playing'
        ? `-# ${message.author.tag} • Clique avant le crash`
        : `-# ${message.author.tag} • Partie terminée`
    )
  );

  return container;
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

    const gameMessage = await message.reply({
      flags: MessageFlags.IsComponentsV2,
      components: [buildCrashContainer(message, game)]
    });

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

      await gameMessage.edit({
        components: [buildCrashContainer(message, game)]
      }).catch(() => {});
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

        await gameMessage.edit({
          components: [buildCrashContainer(message, game)]
        });
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

      await gameMessage.edit({
        components: [buildCrashContainer(message, game)]
      }).catch(() => {});
    });

    collector.on('end', async (_, reason) => {
      if (game.ended) return;

      if (reason === 'time') {
        await finishLoss();
      }
    });
  }
};
