const { EmbedBuilder } = require("discord.js");
const config = require('../../config/botConfig.js');
const { getConfiguredChannelId } = require('../../utils/configService.js');
const parseAmount = require('../../utils/parseAmount.js');
const { sleep } = require('../../utils');
const { formatAmount } = require('../../utils/formatAmount.js');
const { sendStaffLog, buildCoinMovementLog } = require('../../utils/staffLogs.js');
const { debitBalance, drainPocket, creditBalance, getAccount } = require('../../utils/economyService.js');
const {
  tryAcquireActiveGame,
  updateActiveGame,
  releaseActiveGame,
  buildActiveGameEmbed
} = require('../../utils/activeGameLock.js');

const {
  winChance: SLOT_WIN_CHANCE,
  spinMs: SLOT_SPIN_MS,
  spinGif: SLOT_GIF,
  winGif: WIN_GIF,
  loseGif: LOSE_GIF
} = config.games.slots;

module.exports = {
  name: 'slot',
  description: 'Jouez aux machines à sous. Ajoutez `all` au nom pour miser toute votre poche.',
  async execute(message, args, options = {}) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const slotChannelId = getConfiguredChannelId('slots', guildId);
    let activeGameToken = null;

    if (message.channel.id !== slotChannelId) {
      const warningMessage = await message.reply(
        `❌・Les slots sont uniquement disponibles dans <#${slotChannelId}>.\n🕒 Suppression dans **5 secondes**.`
      );

      for (let seconds = 4; seconds >= 1; seconds--) {
        await sleep(1000);
        await warningMessage.edit(
          `❌・Les slots sont uniquement disponibles dans <#${slotChannelId}>.\n🕒 Suppression dans **${seconds} seconde${seconds > 1 ? 's' : ''}**.`
        );
      }

      await sleep(1000);
      await warningMessage.delete().catch(() => {});
      await message.delete().catch(() => {});
      return;
    }

    try {
      const allIn = options.all === true;
      let amount;
      let userCoins;

      if (!allIn) {
        amount = parseAmount(args[0]);

        if (isNaN(amount) || amount <= 0) {
          return message.reply(
            '❌・Veuillez miser un montant valide de coins.'
          );
        }
      }

      const activeGame = tryAcquireActiveGame({
        userId,
        guildId,
        game: allIn ? 'Slots ALL' : 'Slots',
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
            '❌・Vous n\'avez pas assez de coins pour jouer.'
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
            '❌・Vous n\'avez pas assez de coins pour jouer.'
          );
        }
      }

      const slotEmbed = new EmbedBuilder()
        .setTitle('Slots')
        .setDescription(
          allIn
            ? `${message.author} vient de lancer les slots en misant **toute sa poche : ${formatAmount(amount)} coins🪙**.`
            : `${message.author} vient de lancer les slots en misant **${formatAmount(amount)}** coins🪙.`
        )
        .setImage(SLOT_GIF)
        .setFooter({
          text: `${message.author.tag} | ${SLOT_SPIN_MS / 1000} secondes avant le résultat`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setColor(0x6b6de6);

      const sentEmbed = await message.reply({ embeds: [slotEmbed] });

      updateActiveGame({
        userId,
        guildId,
        token: activeGameToken,
        channelId: message.channel.id,
        messageId: sentEmbed.id
      });

      await sleep(SLOT_SPIN_MS);

      const result = Math.random() < SLOT_WIN_CHANCE;

      if (result) {
        userCoins = await creditBalance({
          userId: message.author.id,
          guildId,
          target: 'coins',
          amount: amount * 2
        });
      } else {
        userCoins = await getAccount(message.author.id, guildId) || userCoins;
      }

      await sendStaffLog(
        message.guild,
        'economy-logs',
        buildCoinMovementLog({
          title: result ? '🎰 Slots — Gain' : '🎰 Slots — Perte',
          user: message.author,
          delta: result ? amount : -amount,
          pocket: userCoins.coins,
          bank: userCoins.bank,
          reason: allIn ? '+slotall' : '+slot',
          sourceChannel: message.channel,
          details: `Mise : ${formatAmount(amount)} • Résultat : ${result ? 'x2' : 'perdu'}`
        })
      );

      const resultEmbed = new EmbedBuilder()
        .setTitle(result ? '🎉 YOU WIN' : '💀 YOU LOSE')
        .setDescription(
          result
            ? `Vous avez gagné **${formatAmount(amount * 2)}** coins🪙`
            : `Vous avez perdu **${formatAmount(amount)}** coins🪙`
        )
        .setImage(result ? WIN_GIF : LOSE_GIF)
        .setFooter({
          text: `${message.author.tag} | ${result ? 'Gagné x2' : 'Perdu'}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setColor(result ? 0x4caf50 : 0xe91e63);

      await sentEmbed.edit({ embeds: [resultEmbed] });

      releaseActiveGame({
        userId,
        guildId,
        token: activeGameToken
      });
      activeGameToken = null;
    } catch (error) {
      if (activeGameToken) {
        releaseActiveGame({
          userId,
          guildId,
          token: activeGameToken
        });
        activeGameToken = null;
      }

      console.error(error);
      message.reply('Une erreur s\'est produite lors du jeu aux machines à sous.');
    }
  },
};