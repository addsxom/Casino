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

function getNextMultiplier(current) {
  let increase = 0.05;

  if (current >= 2) increase = 0.08;
  if (current >= 5) increase = 0.15;
  if (current >= 10) increase = 0.30;
  if (current >= 25) increase = 0.60;
  if (current >= 50) increase = 1.00;

  return Number((current + increase).toFixed(2));
}

function buildCrashChartUrl(game, frame) {
  const values = game.history.slice(-40);
  const labels = values.map((_, i) => i + 1);
  const lineColor = game.status === 'lost'
    ? '#e91e63'
    : game.status === 'cashed'
      ? '#4caf50'
      : '#6b6de6';

  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: lineColor,
        backgroundColor: 'rgba(107,109,230,0.18)',
        borderWidth: 4,
        pointRadius: values.map((_, i) => i === values.length - 1 ? 6 : 0),
        pointBackgroundColor: lineColor,
        fill: true,
        tension: 0.28
      }]
    },
    options: {
      legend: { display: false },
      animation: { duration: 0 },
      scales: {
        xAxes: [{
          display: true,
          gridLines: { color: 'rgba(255,255,255,0.08)' },
          ticks: { display: false }
        }],
        yAxes: [{
          display: true,
          gridLines: { color: 'rgba(255,255,255,0.08)' },
          ticks: {
            min: 1,
            fontColor: '#c7c9d3',
            callback: value => 'x' + Number(value).toFixed(2)
          }
        }]
      },
      layout: { padding: 18 }
    }
  };

  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?width=900&height=430&backgroundColor=%2311131c&c=${encoded}&v=${frame}`;
}

function buildCrashEmbed(message, game, frame) {
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
    .setImage(buildCrashChartUrl(game, frame))
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
  return {
    embeds: [buildCrashEmbed(message, game, frame)],
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
