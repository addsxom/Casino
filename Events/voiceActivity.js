const UserCoins = require("../Models/UserCoins");

// Utiliser un ensemble pour suivre les utilisateurs ayant déjà reçu des pièces
const usersReceivedCoins = new Set();

module.exports = async (bot) => {
  bot.guilds.cache.forEach(async (guild) => {
    guild.members.cache.forEach(async (member) => {
      if (
        member &&
        (member.voice.channel ||
          member.presence.streaming ||
          member.presence.activities.some(
            (activity) =>
              activity.type === "CUSTOM_STATUS" && activity.state === "📷"
          ))
      ) {
        const userCoins = await UserCoins.findOne({
          userId: member.id,
          guildId: guild.id,
        });

        if (!userCoins) {
          const newUserCoins = new UserCoins({
            userId: member.id,
            guildId: guild.id,
            coins: 0,
            bank: 0,
            lastVoiceTime: Date.now(),
          });
          await newUserCoins.save();
        } else {
          // Vérifier si le temps passé en vocal est égal à 15 minutes
          const lastVoiceTime = userCoins.lastVoiceTime || 0;
          const timeDifference = Date.now() - lastVoiceTime;
          const fifteenMinutes = 15 * 60 * 1000;

          if (timeDifference >= fifteenMinutes) {
            const bonusCoins = 1000;
            userCoins.coins += bonusCoins;
            await userCoins.save();

            const channel = guild.channels.cache.get("1132784655817519225");
            if (channel) {
              channel.send(
                `${member}, vous avez gagné ${bonusCoins} pièces supplémentaires pour être en vocal, en streaming ou en caméra pendant au moins 15 minutes !`
              );
            }

            userCoins.lastVoiceTime = Date.now();
            await userCoins.save();
          }
        }

        if (!usersReceivedCoins.has(member.id)) {
          usersReceivedCoins.add(member.id);

          // Utiliser une promesse pour gérer le délai
          await new Promise((resolve) => {
            setTimeout(() => {
              usersReceivedCoins.delete(member.id);
              resolve();
            }, 15 * 60 * 1000); // Délai de 15 minutes
          });
        }
      }
    });
  });
};
