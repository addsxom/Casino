const Discord = require("discord.js");
const config = require('../config/botConfig.js');
const ServerPrefix = require("../Models/ServerPrefix");
const {
  incrementAccountField,
  claimMessageMilestone
} = require("../utils/economyService.js");
const {
  getReachedMessageReward,
  sendMessageRewardNotification
} = require("../utils/rewardService.js");
const { sendStaffLog, buildCoinMovementLog } = require("../utils/staffLogs.js");
const { cacheMessage } = require("../utils/messageCache.js");
const { replyEmbedPayload } = require("../utils/replyEmbed.js");
const {
  getConfiguredChannelId
} = require("../utils/configService.js");

const MISC_COMMAND_CATEGORIES = new Set([
  'General',
  'Gestion coins',
  'Recup'
]);

async function enforceMiscCommandChannel(
  message,
  command
) {
  if (
    !message.guild ||
    !MISC_COMMAND_CATEGORIES.has(
      command?.category
    )
  ) {
    return true;
  }

  const miscChannelId =
    getConfiguredChannelId(
      'misccmd',
      message.guild.id
    );

  if (
    !miscChannelId ||
    message.channel.id ===
      miscChannelId
  ) {
    return true;
  }

  await message
    .delete()
    .catch(() => {});

  const warning =
    await message.channel
      .send(
        replyEmbedPayload(
          `Utilise cette commande dans <#${miscChannelId}> pour éviter de polluer les autres salons.`,
          {
            type: 'warning',
            title: '📌 Salon des commandes'
          }
        )
      )
      .catch(() => null);

  if (warning) {
    setTimeout(() => {
      warning
        .delete()
        .catch(() => {});
    }, 5000);
  }

  return false;
}

module.exports = async (bot, message) => {
  cacheMessage(message);

  try {
    const defaultPrefix = process.env.PREFIX || "!";
    let prefix = defaultPrefix;

    if (message.channel.type === "DM") {
      prefix = process.env.PREFIX || "!";
    } else if (message.guild) {
      const serverData = await ServerPrefix.findOne({
        guildId: message.guild.id,
      });

      if (serverData && serverData.prefix) {
        prefix = serverData.prefix;
      }
    }

    if (message.content === `<@${bot.user.id}>`) {
      message.channel.send(
        replyEmbedPayload(
          `Mon préfixe sur ce serveur est : \`${prefix}\``,
          {
            type: 'info',
            title: '⌨️ Préfixe du bot'
          }
        )
      );
    } else if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      let resolvedCommandName =
        bot.aliases.get(commandName) || commandName;
      let command = bot.commands.get(resolvedCommandName);
      const commandOptions = {
        all: false,
        invokedName: commandName
      };

      if (
        !command &&
        commandName.endsWith('all') &&
        commandName.length > 3
      ) {
        const baseName = commandName.slice(0, -3);
        resolvedCommandName =
          bot.aliases.get(baseName) || baseName;

        const baseCommand =
          bot.commands.get(resolvedCommandName);

        if (baseCommand?.category === 'Jeux') {
          command = baseCommand;
          commandOptions.all = true;
        }
      }

      if (command) {
        try {
          const allowedHere =
            await enforceMiscCommandChannel(
              message,
              command
            );

          if (!allowedHere) {
            return;
          }

          await command.execute(
            message,
            args,
            commandOptions
          );
        } catch (error) {
          console.error(error);

          const channel = message.channel;

          if (
            channel &&
            typeof channel.send === 'function'
          ) {
            await channel.send(
              replyEmbedPayload(
                "Une erreur s'est produite lors de l'exécution de la commande.",
                { type: 'error' }
              )
            ).catch(() => {});
          }
        }
      }
    } else {
      if (!message.author.bot) {
        const messageLength =
          [...String(message.content || '').trim()].length;

        if (
          message.guild &&
          message.guild.id &&
          messageLength >= config.rewards.messages.minimumCharacters
        ) {
          const userCoins = await incrementAccountField({
            userId: message.author.id,
            guildId: message.guild.id,
            field: 'messages',
            amount: 1
          });

          const reward =
            getReachedMessageReward(userCoins.messages);

          if (
            reward &&
            (Number(userCoins.messageRewardThreshold) || 0) <
              reward.threshold
          ) {
            const rewardedAccount =
              await claimMessageMilestone({
                userId: message.author.id,
                guildId: message.guild.id,
                threshold: reward.threshold,
                amount: reward.coins
              });

            if (rewardedAccount) {
              await sendStaffLog(
                message.guild,
                'economy-logs',
                buildCoinMovementLog({
                  title: '💬 Récompense de messages',
                  user: message.author,
                  delta: reward.coins,
                  pocket: rewardedAccount.coins,
                  bank: rewardedAccount.bank,
                  reason:
                    `${reward.threshold} messages atteints`,
                  sourceChannel: message.channel
                })
              );

              await sendMessageRewardNotification({
                guild: message.guild,
                user: message.author,
                reward,
                account: rewardedAccount
              }).catch(error => {
                console.error(
                  'Erreur notification récompense message :',
                  error
                );
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
};
