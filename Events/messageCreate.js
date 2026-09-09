const Discord = require("discord.js");
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
      const diff = "``";
      message.channel.send({
        content: `Mon préfixe sur ce serveur est: ${diff}${prefix}${diff}`,
      });
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
          await command.execute(
            message,
            args,
            commandOptions
          );
        } catch (error) {
          console.error(error);
          message.channel.send(
            "Une erreur s'est produite lors de l'exécution de la commande."
          );
        }
      }
    } else {
      if (!message.author.bot) {
        const messageLength =
          String(message.content || '').trim().length;

        if (
          message.guild &&
          message.guild.id &&
          messageLength >= 3
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
