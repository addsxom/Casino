const { ActivityType } = require("discord.js");
const colors = require("colors");
const mongoose = require("mongoose");
const { joinVoiceChannel } = require('@discordjs/voice');
const GUILD_ID = '1546311652830351450';
const CHANNEL_ID = '1546360551503044658';
const prefix = process.env.PREFIX;
const Owner = require('../Models/Owner');
const BotInfo = require('../Models/BotInfo');

module.exports = async (bot) => {
  console.log("[DEBUG READY] clientReady déclenché");

  mongoose.set("strictQuery", false);

  console.log("[DEBUG READY] Connexion MongoDB...");
  await mongoose.connect(process.env.MONGODB).then(() => {
    console.log(colors.bold.magenta("Database • connection established"));
    console.log(colors.bold.magenta("0===========================0"));
  });
  console.log("[DEBUG READY] MongoDB connecté");

  console.log("[DEBUG READY] Recherche BotInfo...");
  const botInfo = await BotInfo.findOne();
  console.log("[DEBUG READY] BotInfo chargé");

  const botName = botInfo ? botInfo.botName : "Kuromi-Coins 🎀";
  const activitytext = botInfo ? botInfo.activityText : "Kuromi-Coins 🎀";
  const activitytext2 = botInfo ? botInfo.activityText : `${prefix}help for ${bot.guilds.cache.reduce((acc, guild) => acc + guild.memberCount,0)} users!`;
  const activityType = botInfo ? botInfo.activityType : ActivityType.Listening;
  const status = botInfo ? botInfo.status : "dnd";
  const guildId = botInfo ? botInfo.guildId : GUILD_ID;

  const activities = [
    { name: activitytext, type: activityType },
    { name: activitytext2, type: activityType },
  ];
  bot.user.setActivity(activities[0]);

  let i = 1;
  setInterval(() => {
    if (i >= activities.length) i = 0;
    bot.user.setActivity(activities[i]);
    i++;
  }, 5000);

  bot.user.setStatus(status);

  const BuyerID = process.env.BUYER;
  let isBuyerInOwner = false;
  
  try {
    console.log("[DEBUG READY] Vérification Owner...");
    isBuyerInOwner = await Owner.exists({ userId: BuyerID });
    console.log("[DEBUG READY] Vérification Owner terminée");
  } catch (error) {
    console.error(`Erreur lors de la vérification de l\'ID ${BuyerID} dans la collection Owner:`, error);
    console.error(colors.bold.blue("0==================================================================================0"));
  }

  if (isBuyerInOwner) {
    console.error(colors.bold.blue(`L\'ID ${BuyerID} est correcte.`));
    console.error(colors.bold.blue("0====================================0"));
  }

  if (!isBuyerInOwner) {
    console.error(colors.bold.blue(`Le Buyer n\'a pas la bonne ID dans la collection Owner.`));
    console.error(colors.bold.blue("0=====================================================0"));
    try {
      await Owner.findOneAndUpdate({ userId: process.env.BUYER }, { userId: BuyerID }, { upsert: true });
      console.log(`L\'ID ${BuyerID} a été mis à jour dans la collection Owner.`);
      console.log(colors.bold.blue("0=================================================================0"));
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de l\'ID ${BuyerID} dans la collection Owner:`, error);
      console.error(colors.bold.blue("0=================================================================================0"));
    }
  }
  
  console.log(colors.bold.red(`${botName} • Online`));
  console.log(colors.bold.red("0===========================0"));

  console.log("[DEBUG READY] Recherche du serveur...");
  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    console.error('Le bot n\'est pas sur le serveur spécifié.');
    return;
  }

  console.log("[DEBUG READY] Connexion au salon vocal...");

  const connection = joinVoiceChannel({
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator
  });

  console.log("[DEBUG READY] joinVoiceChannel appelé");

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[DEBUG VOICE] ${oldState.status} -> ${newState.status}`);
  });
};

