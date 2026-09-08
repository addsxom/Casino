const { ActivityType } = require("discord.js");
const colors = require("colors");
const mongoose = require("mongoose");
const { joinVoiceChannel } = require('@discordjs/voice');
const GUILD_ID = '1546311652830351450';
const CHANNEL_ID = '1546360551503044658';
const WELCOME_CHANNEL_ID = '1546311653388189718';
const prefix = process.env.PREFIX;
const Owner = require('../Models/Owner');
const BotInfo = require('../Models/BotInfo');
const { updateMemberCount } = require('../utils/updateMemberCount.js');
const MEMBER_COUNT_RESYNC_MS = 10 * 60 * 1000;

module.exports = async (bot) => {
  mongoose.set("strictQuery", false);
  await mongoose.connect(process.env.MONGODB).then(() => {
    console.log(colors.bold.magenta("Database • connection established"));
    console.log(colors.bold.magenta("0===========================0"));
  });

  const botInfo = await BotInfo.findOne();

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
    isBuyerInOwner = await Owner.exists({ userId: BuyerID });
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

  const guild = bot.guilds.cache.get(guildId);

  if (!guild) {
    console.error('Le bot n\'est pas sur le serveur spécifié.');
    return;
  }

  await updateMemberCount(guild);

  try {
    const welcomeChannel =
      guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
      await guild.channels.fetch(WELCOME_CHANNEL_ID);

    if (welcomeChannel && guild.systemChannelId !== WELCOME_CHANNEL_ID) {
      await guild.setSystemChannel(
        welcomeChannel,
        'Salon système d’arrivée'
      );
    }
  } catch (error) {
    console.error(
      'Erreur configuration salon système :',
      error?.code || error?.message || error
    );
  }

  // Sécurité : resynchronise aussi le compteur périodiquement
  // au cas où un événement Discord aurait été manqué.
  setInterval(() => {
    updateMemberCount(guild).catch(error => {
      console.error('Erreur resynchronisation compteur membres :', error);
    });
  }, MEMBER_COUNT_RESYNC_MS);

  const connection = joinVoiceChannel({
    channelId: CHANNEL_ID,
    guildId: GUILD_ID,
    adapterCreator: guild.voiceAdapterCreator
  });

  connection.on('stateChange', (_oldState, _newState) => {
  });
};

