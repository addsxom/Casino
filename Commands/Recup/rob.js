const { EmbedBuilder } = require("discord.js");
const UserRobCooldown = require('../../Models/UserRobCooldown.js');
const UserRobProtection = require('../../Models/UserRobProtection.js');
const { formatAmount } = require('../../utils/formatAmount.js');
const {
  sendStaffLog,
  buildCoinMovementLog
} = require('../../utils/staffLogs.js');
const {
  InsufficientFundsError,
  getAccount,
  removeUpTo,
  transferCoins
} = require('../../utils/economyService.js');
const {
  tryAcquireCooldown,
  releaseCooldown
} = require('../../utils/cooldownService.js');

const ROBBER_COOLDOWN_MS = 1000;
const VICTIM_PROTECTION_MS = 1000;
const MIN_TARGET_POCKET = 1000;

const SUCCESS_CHANCE = 0.55;
const JACKPOT_CHANCE = 0.05;
const FINE_CHANCE = 0.50;

function randomInt(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(
    0,
    Math.ceil(ms / 1000)
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  const parts = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (hours === 0 && seconds > 0) {
    parts.push(`${seconds}s`);
  }

  return parts.join(' ') || 'quelques secondes';
}

async function clearLegacyTestCooldown(
  Model,
  userId,
  guildId,
  maxDurationMs
) {
  const existing = await Model.findOne({
    userId,
    guildId
  });

  const availableAt = Number(existing?.cooldown) || 0;
  const remaining = availableAt - Date.now();

  if (remaining > maxDurationMs) {
    await Model.updateOne(
      { userId, guildId },
      { $set: { cooldown: 0 } }
    );
  }
}
async function getProtection(userId, guildId) {
  const protection = await UserRobProtection.findOne({
    userId,
    guildId
  });

  const availableAt = Number(protection?.cooldown) || 0;

  return {
    active: availableAt > Date.now(),
    availableAt
  };
}

function buildSuccessEmbed({
  message,
  targetUser,
  stolenCoins,
  stolenPercent,
  jackpot
}) {
  const jackpotLine = jackpot
    ? '\n💎 **JACKPOT !**'
    : '';

  return new EmbedBuilder()
    .setTitle(
      jackpot
        ? '💎 Jackpot !'
        : '🦹 Braquage réussi'
    )
    .setDescription(
      `${message.author} ➜ ${targetUser}\n\n` +
      `💰 **${formatAmount(stolenCoins)} coins**\n` +
      `-# ${stolenPercent}% de la poche${jackpotLine}\n\n` +
      '🛡️ Victime protégée **1s**'
    )
    .setThumbnail(
      targetUser.displayAvatarURL({
        dynamic: true
      })
    )
    .setColor(
      jackpot
        ? 0xf1c40f
        : 0x57f287
    )
    .setFooter({
      text: 'Prochain rob dans 1s • Kuromi Coins',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    });
}

function buildFailureEmbed({
  message,
  targetUser,
  fineApplied,
  finePercent,
  fineAmount
}) {
  let resultText = '🍀 **Aucune amende**';

  if (fineApplied) {
    resultText = fineAmount > 0
      ? `🚨 **-${formatAmount(fineAmount)} coins**\n-# Amende de ${finePercent}%`
      : `🚨 **Amende de ${finePercent}%**\n-# Aucun coin en poche à payer`;
  }

  return new EmbedBuilder()
    .setTitle('🚔 Braquage raté')
    .setDescription(
      `${message.author} ➜ ${targetUser}\n\n` +
      resultText
    )
    .setThumbnail(
      targetUser.displayAvatarURL({
        dynamic: true
      })
    )
    .setColor(0xed4245)
    .setFooter({
      text: 'Prochain rob dans 1s • Kuromi Coins',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    });
}

module.exports = {
  name: 'rob',
  description: 'Tentez de voler les coins en poche d’un utilisateur.',

  async execute(message, args) {
    const guildId = message.guild.id;
    const robberId = message.author.id;

    try {
      const targetUser =
        message.mentions.users.first() ||
        message.client.users.cache.get(args[0]);

      if (!targetUser) {
        return message.reply(
          '❌・Veuillez mentionner un utilisateur à rob.'
        );
      }

      if (targetUser.bot) {
        return message.reply(
          '❌・Tu ne peux pas voler un bot.'
        );
      }

      if (targetUser.id === robberId) {
        return message.reply(
          '❌・Tu ne peux pas te voler toi-même.'
        );
      }

      let targetCoins = await getAccount(
        targetUser.id,
        guildId
      );

      if (
        !targetCoins ||
        targetCoins.coins < MIN_TARGET_POCKET
      ) {
        return message.reply(
          `🛡️・${targetUser.tag} n’a pas assez de coins en poche pour être braqué.\n` +
          `Il faut au minimum **${formatAmount(MIN_TARGET_POCKET)} coins** en poche.`
        );
      }

      await clearLegacyTestCooldown(
        UserRobProtection,
        targetUser.id,
        guildId,
        VICTIM_PROTECTION_MS
      );

      const existingProtection = await getProtection(
        targetUser.id,
        guildId
      );

      if (existingProtection.active) {
        return message.reply(
          `🛡️・${targetUser.tag} a déjà été braqué récemment.\n` +
          `Protection restante : **${formatRemaining(existingProtection.availableAt - Date.now())}**.`
        );
      }

      await clearLegacyTestCooldown(
        UserRobCooldown,
        robberId,
        guildId,
        ROBBER_COOLDOWN_MS
      );

      const robberCooldown = await tryAcquireCooldown(
        UserRobCooldown,
        {
          userId: robberId,
          guildId,
          durationMs: ROBBER_COOLDOWN_MS
        }
      );

      if (!robberCooldown.acquired) {
        return message.reply(
          '⏳・Tu as déjà tenté un braquage récemment.\n' +
          `Tu pourras recommencer dans **${formatRemaining(robberCooldown.availableAt - Date.now())}**.`
        );
      }

      const success = Math.random() < SUCCESS_CHANCE;

      if (success) {
        const victimProtection = await tryAcquireCooldown(
          UserRobProtection,
          {
            userId: targetUser.id,
            guildId,
            durationMs: VICTIM_PROTECTION_MS
          }
        );

        if (!victimProtection.acquired) {
          await releaseCooldown(
            UserRobCooldown,
            {
              userId: robberId,
              guildId,
              availableAt: robberCooldown.availableAt
            }
          );

          return message.reply(
            `🛡️・${targetUser.tag} vient d’être protégé par un autre braquage.\n` +
            'Ton cooldown n’a pas été consommé.'
          );
        }

        targetCoins = await getAccount(
          targetUser.id,
          guildId
        );

        if (
          !targetCoins ||
          targetCoins.coins < MIN_TARGET_POCKET
        ) {
          await releaseCooldown(
            UserRobProtection,
            {
              userId: targetUser.id,
              guildId,
              availableAt: victimProtection.availableAt
            }
          );

          await releaseCooldown(
            UserRobCooldown,
            {
              userId: robberId,
              guildId,
              availableAt: robberCooldown.availableAt
            }
          );

          return message.reply(
            `🛡️・${targetUser.tag} n’a plus assez de coins en poche pour être braqué.\n` +
            'Ton cooldown n’a pas été consommé.'
          );
        }

        const jackpot = Math.random() < JACKPOT_CHANCE;
        const stolenPercent = jackpot
          ? randomInt(50, 75)
          : randomInt(1, 40);

        const stolenCoins = Math.max(
          1,
          Math.floor(
            targetCoins.coins *
            (stolenPercent / 100)
          )
        );

        let transfer;

        try {
          transfer = await transferCoins({
            guildId,
            senderId: targetUser.id,
            recipientId: robberId,
            source: 'coins',
            amount: stolenCoins
          });
        } catch (error) {
          await releaseCooldown(
            UserRobProtection,
            {
              userId: targetUser.id,
              guildId,
              availableAt: victimProtection.availableAt
            }
          );

          if (
            error instanceof InsufficientFundsError ||
            error?.code === 'INSUFFICIENT_FUNDS'
          ) {
            return message.reply(
              '❌・Le braquage a échoué car le solde de la victime a changé pendant la tentative.'
            );
          }

          throw error;
        }

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: jackpot
              ? '💎 Rob — JACKPOT'
              : '🦹 Rob — Réussi',
            user: message.author,
            delta: stolenCoins,
            pocket: transfer.recipientDocument.coins,
            bank: transfer.recipientDocument.bank,
            reason: '+rob',
            details:
              `Victime : ${targetUser.tag} • ` +
              `Vol : ${stolenPercent}%` +
              (jackpot ? ' • JACKPOT' : '')
          })
        );

        await sendStaffLog(
          message.guild,
          'economy-logs',
          buildCoinMovementLog({
            title: '💸 Rob — Victime',
            user: targetUser,
            delta: -stolenCoins,
            pocket: transfer.senderDocument.coins,
            bank: transfer.senderDocument.bank,
            reason: '+rob',
            details:
              `Voleur : ${message.author.tag} • ` +
              `Vol : ${stolenPercent}% • Protection : 1s`
          })
        );

        const embed = buildSuccessEmbed({
          message,
          targetUser,
          stolenCoins,
          stolenPercent,
          jackpot
        });

        return message.reply({
          embeds: [embed]
        });
      }

      const fineApplied = Math.random() < FINE_CHANCE;
      let finePercent = 0;
      let fineAmount = 0;
      let robberCoins = await getAccount(
        robberId,
        guildId
      );

      if (fineApplied) {
        finePercent = randomInt(5, 10);

        if (robberCoins?.coins > 0) {
          const desiredFine = Math.max(
            1,
            Math.floor(
              robberCoins.coins *
              (finePercent / 100)
            )
          );

          const fine = await removeUpTo({
            userId: robberId,
            guildId,
            field: 'coins',
            amount: desiredFine
          });

          if (fine) {
            fineAmount = fine.removed;
            robberCoins = {
              ...robberCoins.toObject(),
              coins: fine.after.coins,
              bank: fine.after.bank
            };
          }
        }
      }

      if (!robberCoins) {
        robberCoins = {
          coins: 0,
          bank: 0
        };
      }

      await sendStaffLog(
        message.guild,
        'economy-logs',
        buildCoinMovementLog({
          title: fineAmount > 0
            ? '🚔 Rob — Raté avec amende'
            : '❌ Rob — Raté',
          user: message.author,
          delta: -fineAmount,
          pocket: robberCoins.coins,
          bank: robberCoins.bank,
          reason: '+rob',
          details:
            `Victime : ${targetUser.tag} • Échec` +
            (fineApplied
              ? ` • Amende : ${finePercent}%`
              : ' • Aucune amende')
        })
      );

      const embed = buildFailureEmbed({
        message,
        targetUser,
        fineApplied,
        finePercent,
        fineAmount
      });

      return message.reply({
        embeds: [embed]
      });
    } catch (error) {
      console.error('Rob command error:', error);

      return message.reply(
        '❌・Une erreur s’est produite lors de la tentative de vol.'
      );
    }
  },
};
