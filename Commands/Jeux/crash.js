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

function buildCrashContainer(message, game) {
  let title = '# 🚀 CRASH';
  let color = 0x6b6de6;
  let body =
    `**Mise :** ${formatCoins(game.amount)} coins🪙\n` +
    `**Multiplicateur :** x${game.multiplier.toFixed(2)}\n` +
    `**Gain actuel :** ${formatCoins(game.amount * game.multiplier)} coins🪙\n` +
    `\u200B\n` +
    `Cash Out avant le crash.`;

  if (game.status === 'lost') {
    title = '# 💥 CRASH !';
    color = 0xe91e63;
    body =
      `Le jeu a crash à **x${game.crashPoint.toFixed(2)}**.\n` +
      `Tu as perdu **${formatCoins(game.amount)} coins🪙**.`;
  }

  if (game.status === 'cashed') {
    title = '# 💰 CASH OUT';
    color = 0x4caf50;
    body =
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
      ended: false
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
          await finishLoss();
          return;
        }

        game.multiplier = nextMultiplier;

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
