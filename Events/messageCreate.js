const Discord = require("discord.js");
const ServerPrefix = require("../Models/ServerPrefix");
const UserCoins = require("../Models/UserCoins");
const { formatAmount } = require("../utils/formatAmount.js");

// Créez un ensemble pour stocker les utilisateurs ayant déjà reçu des pièces pour la session actuelle
const usersReceivedCoins = new Set();

module.exports = async (bot, message) => {
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

      const command = bot.commands.get(commandName);
      if (command) {
        try {
          await command.execute(message, args);
        } catch (error) {
          console.error(error);
          message.channel.send(
            "Une erreur s'est produite lors de l'exécution de la commande."
          );
        }
      }
    } else {
      if (!message.author.bot) {
        if (message.guild && message.guild.id) {
          let userCoins = await UserCoins.findOne({
            userId: message.author.id,
            guildId: message.guild.id,
          });
      
          if (!userCoins) {
            const newUserCoins = new UserCoins({
              userId: message.author.id,
              guildId: message.guild.id,
              coins: 0,
              bank: 0,
              messages: 0,
            });
            await newUserCoins.save();
          }
      
          userCoins = await UserCoins.findOneAndUpdate(
            { userId: message.author.id, guildId: message.guild.id },
            { $inc: { messages: 1 } },
            { new: true }
          );
      
          const thresholdResult = await userCoins.checkMessageThreshold();
      
          if (thresholdResult) {
            const channel = message.guild.channels.cache.get('1132784655817519225');
            if (channel) {
              channel.send(`${message.author}, vous avez gagné ${formatAmount(thresholdResult.coins)} coins dans votre banque pour avoir atteint ${thresholdResult.threshold} messages !`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
};
