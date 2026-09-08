const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const { formatAmount: formatCoins } = require('../../utils/formatAmount.js');
const parseAmount = require('../../utils/parseAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');
const { debitBalance, drainPocket, creditBalance, getAccount } = require('../../utils/economyService.js');
const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
} = require('../../utils/activeGameLock.js');

const HOUSE_EDGE = 0.03;
const MAX_CRASH = 100;
const LIVE_UPDATE_MS = 900;

function generateCrashPoint() {
  const random = Math.random();
  const raw = (1 - HOUSE_EDGE) / (1 - random);
  const point = Math.floor(raw * 100) / 100;

  return Math.min(
    MAX_CRASH,
    Math.max(1, point)
  );
}

function getMultiplierAt(startedAt, at = Date.now()) {
  const elapsedSeconds = Math.max(
    0,
    (at - startedAt) / 1000
  );

  // Courbe continue : douce au départ puis accélère progressivement.
  const exponent =
    0.05 * elapsedSeconds +
    0.0015 * elapsedSeconds * elapsedSeconds;

  return Number(
    Math.min(
      MAX_CRASH,
      Math.exp(exponent)
    ).toFixed(2)
  );
}

function getFlightPhase(multiplier) {
  if (multiplier < 1.35) {
    return {
      name: 'Décollage',
      icon: '🛫'
    };
  }

  if (multiplier < 2) {
    return {
      name: 'Ascension',
      icon: '🚀'
    };
  }

  if (multiplier < 5) {
    return {
      name: 'Haute altitude',
      icon: '☁️'
    };
  }

  if (multiplier < 15) {
    return {
      name: 'Stratosphère',
      icon: '🌌'
    };
  }

  return {
    name: 'Orbite',
    icon: '🪐'
  };
}

function buildFlightTrack(multiplier) {
  const length = 14;

  const normalized = Math.min(
    1,
    Math.log10(Math.max(1, multiplier)) / 2
  );

  const rocketIndex = Math.min(
    length - 1,
    Math.floor(normalized * (length - 1))
  );

  const track = [];

  for (let i = 0; i < length; i++) {
    if (i === rocketIndex) {
      track.push('🚀');
    } else if (i < rocketIndex) {
      track.push('━');
    } else {
      track.push('·');
    }
  }

  return track.join('');
}

function buildPlayingEmbed(message, game) {
  const potential = Math.floor(
    game.amount * game.multiplier
  );

  return new EmbedBuilder()
    .setColor(0x8b8df8)
    .setTitle(
      `🚀 x${game.multiplier.toFixed(2)}`
    )
    .setDescription(
      `**Gain actuel :** ${formatCoins(potential)} coins🪙\n` +
      `**Mise :** ${formatCoins(game.amount)} coins🪙\n\n` +
      `🟢 **En cours**`
    )
    .setFooter({
      text:
        `${message.author.tag} • Cash Out avant le crash`
    });
}

function buildResultEmbed(message, game) {
  if (game.status === 'lost') {
    return new EmbedBuilder()
      .setColor(0xef476f)
      .setTitle(
        `💥 Crash à x${game.crashPoint.toFixed(2)}`
      )
      .setDescription(
        `**Perte :** -${formatCoins(game.amount)} coins🪙`
      )
      .setFooter({
        text:
          `${message.author.tag} • Terminé`
      });
  }

  return new EmbedBuilder()
    .setColor(0x46d18c)
    .setTitle(
      `✅ Cash Out à x${game.cashoutMultiplier.toFixed(2)}`
    )
    .setDescription(
      `**Gain :** ${formatCoins(game.payout)} coins🪙\n` +
      `**Mise :** ${formatCoins(game.amount)} coins🪙`
    )
    .setFooter({
      text:
        `${message.author.tag} • Terminé`
    });
}

function buildCashoutRow() {
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

module.exports = {
  name: 'crash',
  description:
    'Misez des coins et cash out avant le crash. Ajoutez `all` au nom pour miser toute votre poche.',

  async execute(message, args, options = {}) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const allIn = options.all === true;
    let amount;
    let userCoins;
    let activeGameToken = null;

    if (!allIn) {
      amount = parseAmount(args[0]);

      if (
        !Number.isInteger(amount) ||
        amount <= 0
      ) {
        return message.reply(
          '❌・Utilisation : **+crash <mise>**\n' +
          'Exemple : **+crash 1000**'
        );
      }
    }

    const activeGame = tryAcquireActiveGame({
      userId,
      guildId,
      game: allIn ? 'Crash ALL' : 'Crash',
      channelId: message.channel.id
    });

    if (!activeGame.acquired) {
      return message.reply({
        embeds: [
          buildActiveGameEmbed(
            message,
            activeGame.activeGame
          )
        ]
      });
    }

    activeGameToken = activeGame.token;

    if (allIn) {
      const drained = await drainPocket(
        userId,
        guildId
      );

      if (!drained || drained.amount <= 0) {
        releaseActiveGame({
          userId,
          guildId,
          token: activeGameToken
        });
        activeGameToken = null;

        return message.reply(
          '❌・Vous n\'avez pas assez de coins pour cette mise.'
        );
      }

      amount = drained.amount;
      userCoins = await getAccount(
        userId,
        guildId
      );
    } else {
      userCoins = await debitBalance({
        userId,
        guildId,
        source: 'coins',
        amount
      });

      if (!userCoins) {
        releaseActiveGame({
          userId,
          guildId,
          token: activeGameToken
        });
        activeGameToken = null;

        return message.reply(
          '❌・Vous n\'avez pas assez de coins pour cette mise.'
        );
      }
    }

    const game = {
      amount,
      crashPoint: generateCrashPoint(),
      multiplier: 1,
      cashoutMultiplier: 0,
      payout: 0,
      status: 'playing',
      ended: false,
      locked: false,
      startedAt: Date.now()
    };

    let gameMessage;

    try {
      gameMessage = await message.reply({
        embeds: [
          buildPlayingEmbed(
            message,
            game
          )
        ],
        components: buildCashoutRow()
      });
    } catch (error) {
      await creditBalance({
        userId,
        guildId,
        target: 'coins',
        amount
      });

      if (activeGameToken) {
        releaseActiveGame({
          userId,
          guildId,
          token: activeGameToken
        });
        activeGameToken = null;
      }

      console.error(
        'Crash start error:',
        error
      );

      return message.reply(
        '❌・Impossible de lancer le Crash.'
      );
    }

    updateActiveGame({
      userId,
      guildId,
      token: activeGameToken,
      channelId: message.channel.id,
      messageId: gameMessage.id
    });

    // L'horloge commence quand le message est réellement envoyé.
    game.startedAt = Date.now();

    const collector =
      gameMessage.createMessageComponentCollector({
        time: 180000
      });

    const finishLoss = async () => {
      if (game.ended || game.locked) {
        return;
      }

      game.ended = true;
      game.status = 'lost';
      game.multiplier =
        game.crashPoint;

      clearInterval(liveTimer);
      collector.stop('crashed');

      await gameMessage.edit({
        embeds: [
          buildResultEmbed(
            message,
            game
          )
        ],
        components: []
      }).catch(() => {});

      try {
        const latestCoins = await getAccount(
          userId,
          guildId
        );

        if (latestCoins) {
          await sendStaffLog(
            message.guild,
            'economy-logs',
            buildCoinMovementLog({
              title: '🚀 Crash — Perte',
              user: message.author,
              delta: -game.amount,
              pocket: latestCoins.coins,
              bank: latestCoins.bank,
              reason: allIn ? '+crashall' : '+crash',
              sourceChannel: message.channel,
              details: `Mise : ${formatCoins(game.amount)} • Crash : x${game.crashPoint.toFixed(2)}`
            })
          );
        }
      } finally {
        if (activeGameToken) {
          releaseActiveGame({
            userId,
            guildId,
            token: activeGameToken
          });
          activeGameToken = null;
        }
      }
    };

    const liveTimer = setInterval(() => {
      if (
        game.ended ||
        game.locked
      ) {
        return;
      }

      const now = Date.now();
      const multiplier =
        getMultiplierAt(
          game.startedAt,
          now
        );

      if (
        multiplier >=
        game.crashPoint
      ) {
        finishLoss().catch(error => {
          console.error(
            'Crash loss error:',
            error
          );
        });
        return;
      }

      game.multiplier =
        multiplier;

      // Mise à jour légère : uniquement embed + composants.
      gameMessage.edit({
        embeds: [
          buildPlayingEmbed(
            message,
            game
          )
        ],
        components: buildCashoutRow()
      }).catch(() => {});
    }, LIVE_UPDATE_MS);

    collector.on(
      'collect',
      async interaction => {
        if (
          interaction.customId !==
          'crash_cashout'
        ) {
          return;
        }

        if (
          interaction.user.id !==
          message.author.id
        ) {
          return interaction.reply({
            content:
              '❌・Cette partie ne vous appartient pas.',
            ephemeral: true
          }).catch(() => {});
        }

        if (
          game.ended ||
          game.locked
        ) {
          return interaction.reply({
            content:
              '💥・Cette partie est déjà terminée.',
            ephemeral: true
          }).catch(() => {});
        }

        const clickedAt = Date.now();

        // À partir d'ici aucun tick ne peut reprendre.
        game.locked = true;
        clearInterval(liveTimer);

        const clickedMultiplier =
          getMultiplierAt(
            game.startedAt,
            clickedAt
          );

        if (
          clickedMultiplier >=
          game.crashPoint
        ) {
          game.locked = false;

          await interaction.deferUpdate()
            .catch(() => {});

          await finishLoss();
          return;
        }

        game.ended = true;
        game.status = 'cashed';
        game.multiplier =
          clickedMultiplier;
        game.cashoutMultiplier =
          clickedMultiplier;

        game.payout = Math.floor(
          game.amount *
          clickedMultiplier
        );

        collector.stop('cashed');

        // Réponse Discord immédiate :
        // aucun Canvas, fichier ou DB avant cet update.
        await interaction.update({
          embeds: [
            buildResultEmbed(
              message,
              game
            )
          ],
          components: []
        });

        try {
          userCoins = await creditBalance({
            userId,
            guildId,
            target: 'coins',
            amount: game.payout
          });

          if (userCoins) {
            await sendStaffLog(
              message.guild,
              'economy-logs',
              buildCoinMovementLog({
                title: '🚀 Crash — Cash Out',
                user: message.author,
                delta: game.payout - game.amount,
                pocket: userCoins.coins,
                bank: userCoins.bank,
                reason: allIn ? '+crashall' : '+crash',
                sourceChannel: message.channel,
                details:
                  `Mise : ${formatCoins(game.amount)} • ` +
                  `Payout : ${formatCoins(game.payout)} • ` +
                  `x${game.cashoutMultiplier.toFixed(2)}`
              })
            );
          }
        } finally {
          if (activeGameToken) {
            releaseActiveGame({
              userId,
              guildId,
              token: activeGameToken
            });
            activeGameToken = null;
          }
        }
      }
    );

    collector.on(
      'end',
      async (_, reason) => {
        if (game.ended) {
          return;
        }

        if (reason === 'time') {
          await finishLoss();
        }
      }
    );
  }
};
