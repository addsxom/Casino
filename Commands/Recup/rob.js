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

const ROBBER_COOLDOWN_MS = 15 * 1000;
const VICTIM_PROTECTION_MS = 15 * 1000;
const MIN_TARGET_POCKET = 1000;

const SUCCESS_CHANCE = 0.55;
const JACKPOT_CHANCE = 0.05;
const FINE_CHANCE = 0.50;

function randomInt(min, max) {
  return Math.floor(
    Math.random() * (max - min + 1)
  ) + min;
}

function formatDynamicTimer(timestampMs) {
  if (!timestampMs || Date.now() >= timestampMs) {
    return '**0s**';
  }

  return `<t:${Math.floor(timestampMs / 1000)}:R>`;
}

function buildInfoEmbed(
  message,
  {
    title,
    description,
    color = 0x6b6de6,
    thumbnail = null
  }
) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({
      text: 'Kuromi Coins',
      iconURL:
        message.client.user.displayAvatarURL({
          dynamic: true
        })
    });

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}

async function replyEmbed(
  message,
  buildEmbed,
  freezeAt = []
) {
  const sent = await message.reply({
    embeds: [buildEmbed()]
  });

  const expirations = [
    ...new Set(
      freezeAt
        .map(Number)
        .filter(timestamp =>
          Number.isFinite(timestamp) &&
          timestamp > Date.now()
        )
    )
  ].sort((a, b) => a - b);

  for (const expiration of expirations) {
    const delay = Math.max(
      0,
      expiration - Date.now() + 250
    );

    setTimeout(() => {
      sent.edit({
        embeds: [buildEmbed()]
      }).catch(() => {});
    }, delay);
  }

  return sent;
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
  jackpot,
  robberAvailableAt,
  victimAvailableAt
}) {
  const jackpotLine = jackpot
    ? '\n💎 **JACKPOT !**'
    : '';

  return buildInfoEmbed(
    message,
    {
      title: jackpot
        ? '💎 Jackpot !'
        : '🦹 Braquage réussi',
      description:
        `${message.author} ➜ ${targetUser}\n\n` +
        `💰 **${formatAmount(stolenCoins)} coins**\n` +
        `-# ${stolenPercent}% de la poche${jackpotLine}\n\n` +
        `🛡️ Protection : ${formatDynamicTimer(victimAvailableAt)}\n` +
        `⏳ Prochain rob : ${formatDynamicTimer(robberAvailableAt)}`,
      color: jackpot
        ? 0xf1c40f
        : 0x57f287,
      thumbnail:
        targetUser.displayAvatarURL({
          dynamic: true
        })
    }
  );
}

function buildFailureEmbed({
  message,
  targetUser,
  fineApplied,
  finePercent,
  fineAmount,
  robberAvailableAt
}) {
  let resultText = '🍀 **Aucune amende**';

  if (fineApplied) {
    resultText = fineAmount > 0
      ? `🚨 **-${formatAmount(fineAmount)} coins**\n-# Amende de ${finePercent}%`
      : `🚨 **Amende de ${finePercent}%**\n-# Aucun coin en poche à payer`;
  }

  return buildInfoEmbed(
    message,
    {
      title: '🚔 Braquage raté',
      description:
        `${message.author} ➜ ${targetUser}\n\n` +
        resultText +
        `\n\n⏳ Prochain rob : ${formatDynamicTimer(robberAvailableAt)}`,
      color: 0xed4245,
      thumbnail:
        targetUser.displayAvatarURL({
          dynamic: true
        })
    }
  );
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
        return replyEmbed(
          message,
          () => buildInfoEmbed(
            message,
            {
              title: '❌ Cible invalide',
              description:
                'Mentionne un utilisateur valide à braquer.',
              color: 0xed4245
            }
          )
        );
      }

      if (targetUser.bot) {
        return replyEmbed(
          message,
          () => buildInfoEmbed(
            message,
            {
              title: '❌ Braquage impossible',
              description:
                'Tu ne peux pas braquer un bot.',
              color: 0xed4245
            }
          )
        );
      }

      if (targetUser.id === robberId) {
        return replyEmbed(
          message,
          () => buildInfoEmbed(
            message,
            {
              title: '❌ Braquage impossible',
              description:
                'Tu ne peux pas te braquer toi-même.',
              color: 0xed4245
            }
          )
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
        return replyEmbed(
          message,
          () => buildInfoEmbed(
            message,
            {
              title: '🛡️ Joueur protégé',
              description:
                `${targetUser} possède moins de **${formatAmount(MIN_TARGET_POCKET)} coins** en poche.\n` +
                'Il ne peut pas être braqué.',
              color: 0x6b6de6,
              thumbnail:
                targetUser.displayAvatarURL({
                  dynamic: true
                })
            }
          )
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
        return replyEmbed(
          message,
          () => buildInfoEmbed(
            message,
            {
              title: '🛡️ Victime protégée',
              description:
                `${targetUser} a déjà été braqué récemment.\n\n` +
                `Protection restante : ${formatDynamicTimer(existingProtection.availableAt)}`,
              color: 0x6b6de6,
              thumbnail:
                targetUser.displayAvatarURL({
                  dynamic: true
                })
            }
          ),
          [existingProtection.availableAt]
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
        return replyEmbed(
          message,
          () => buildInfoEmbed(
            message,
            {
              title: '⏳ Braquage en cooldown',
              description:
                'Tu as déjà tenté un braquage récemment.\n\n' +
                `Prochain rob : ${formatDynamicTimer(robberCooldown.availableAt)}`,
              color: 0x6b6de6
            }
          ),
          [robberCooldown.availableAt]
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

          return replyEmbed(
            message,
            () => buildInfoEmbed(
              message,
              {
                title: '🛡️ Victime protégée',
                description:
                  `${targetUser} vient d’être braqué par quelqu’un d’autre.\n\n` +
                  `Protection restante : ${formatDynamicTimer(victimProtection.availableAt)}\n` +
                  '-# Ton cooldown n’a pas été consommé.',
                color: 0x6b6de6,
                thumbnail:
                  targetUser.displayAvatarURL({
                    dynamic: true
                  })
              }
            ),
            [victimProtection.availableAt]
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

          return replyEmbed(
            message,
            () => buildInfoEmbed(
              message,
              {
                title: '🛡️ Braquage annulé',
                description:
                  `${targetUser} n’a plus assez de coins en poche.\n` +
                  '-# Ton cooldown n’a pas été consommé.',
                color: 0x6b6de6,
                thumbnail:
                  targetUser.displayAvatarURL({
                    dynamic: true
                  })
              }
            )
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
            return replyEmbed(
              message,
              () => buildInfoEmbed(
                message,
                {
                  title: '❌ Braquage interrompu',
                  description:
                    'Le solde de la victime a changé pendant la tentative.\n\n' +
                    `Prochain rob : ${formatDynamicTimer(robberCooldown.availableAt)}`,
                  color: 0xed4245
                }
              ),
              [robberCooldown.availableAt]
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
              `Vol : ${stolenPercent}% • Protection : 15s`
          })
        );

        return replyEmbed(
          message,
          () => buildSuccessEmbed({
            message,
            targetUser,
            stolenCoins,
            stolenPercent,
            jackpot,
            robberAvailableAt:
              robberCooldown.availableAt,
            victimAvailableAt:
              victimProtection.availableAt
          }),
          [
            robberCooldown.availableAt,
            victimProtection.availableAt
          ]
        );
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

      return replyEmbed(
        message,
        () => buildFailureEmbed({
          message,
          targetUser,
          fineApplied,
          finePercent,
          fineAmount,
          robberAvailableAt:
            robberCooldown.availableAt
        }),
        [robberCooldown.availableAt]
      );
    } catch (error) {
      console.error('Rob command error:', error);

      return replyEmbed(
        message,
        () => buildInfoEmbed(
          message,
          {
            title: '❌ Erreur',
            description:
              'Une erreur s’est produite lors de la tentative de vol.',
            color: 0xed4245
          }
        )
      );
    }
  },
};
