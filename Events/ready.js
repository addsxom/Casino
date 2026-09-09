const { ActivityType } = require("discord.js");
const config = require('../config/botConfig.js');
const colors = require("colors");
const mongoose = require("mongoose");
const { joinVoiceChannel } = require('@discordjs/voice');
const GUILD_ID = config.guildId;
const prefix = process.env.PREFIX || '+';
const Owner = require('../Models/Owner');
const BotInfo = require('../Models/BotInfo');
const { updateMemberCount } = require('../utils/updateMemberCount.js');
const { ensureDatabaseIntegrity } = require('../utils/databaseIntegrity.js');
const { startVoiceRewardTracker } = require('../utils/voiceRewardTracker.js');
const { startAfkRewardTracker } = require('../utils/afkRewardTracker.js');
const {
  applyStoredChannelOverrides,
  getConfiguredChannelId
} = require('../utils/configService.js');
const {
  DEFAULT_DYNAMIC_ACTIVITY,
  normalizeActivityTemplate,
  renderActivityText
} = require('../utils/activityText.js');
const MEMBER_COUNT_RESYNC_MS = config.system.memberCountResyncMs;

const ACTIVITY_TYPES = {
  PLAYING: ActivityType.Playing,
  STREAMING: ActivityType.Streaming,
  LISTENING: ActivityType.Listening,
  WATCHING: ActivityType.Watching,
  COMPETING: ActivityType.Competing
};

function resolveActivityType(value) {
  if (typeof value === 'number') return value;

  return ACTIVITY_TYPES[
    String(value || 'LISTENING').toUpperCase()
  ] ?? ActivityType.Listening;
}

module.exports = async (bot) => {
  mongoose.set("strictQuery", false);
  mongoose.set("autoIndex", false);

  await mongoose.connect(process.env.MONGODB).then(() => {
    console.log(colors.bold.magenta("Database • connection established"));
    console.log(colors.bold.magenta("0===========================0"));
  });

  await ensureDatabaseIntegrity();
  await applyStoredChannelOverrides();
  await startVoiceRewardTracker(bot);
  await startAfkRewardTracker(bot);

  const botInfo = await BotInfo.findOne();

  if (botInfo?.activityText2) {
    const normalizedText2 =
      normalizeActivityTemplate(botInfo.activityText2);

    if (normalizedText2 !== botInfo.activityText2) {
      botInfo.activityText2 = normalizedText2;
      await botInfo.save().catch(error => {
        console.error(
          'Erreur migration activityText2 :',
          error?.message || error
        );
      });
    }
  }

  const botName = bot.user.username;
  const activitytext = botInfo?.activityText || "Kuromi-Coins 🎀";
  const activitytext2 =
    botInfo?.activityText2 ||
    DEFAULT_DYNAMIC_ACTIVITY;
  const activityType = resolveActivityType(
    botInfo?.activityType
  );
  const status = botInfo?.status || "dnd";
  const guildId = botInfo?.guildId || GUILD_ID;

  bot.activityRotation = {
    texts: [activitytext, activitytext2].filter(Boolean),
    type: activityType,
    index: 0
  };

  const firstActivity = bot.activityRotation.texts[0];

  if (firstActivity) {
    bot.user.setActivity(
      renderActivityText(firstActivity, bot, prefix),
      {
        type: bot.activityRotation.type
      }
    );
  }

  setInterval(() => {
    const rotation = bot.activityRotation;

    if (!rotation?.texts?.length) return;

    rotation.index =
      (rotation.index + 1) % rotation.texts.length;

    bot.user.setActivity(
      renderActivityText(
        rotation.texts[rotation.index],
        bot,
        prefix
      ),
      { type: rotation.type }
    );
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
    const welcomeChannelId =
      getConfiguredChannelId('welcome', guild.id);

    const welcomeChannel =
      guild.channels.cache.get(welcomeChannelId) ||
      await guild.channels.fetch(welcomeChannelId);

    if (welcomeChannel && guild.systemChannelId !== welcomeChannelId) {
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

  const botVoiceChannelId =
    getConfiguredChannelId('botvoice', guild.id);

  let botVoiceChannel =
    guild.channels.cache.get(botVoiceChannelId) ||
    await guild.channels.fetch(botVoiceChannelId).catch(() => null);

  if (!botVoiceChannel) {
    await guild.channels.fetch().catch(() => null);

    botVoiceChannel = guild.channels.cache.find(
      channel => channel.name === config.channels.botVoice.name
    ) || null;
  }

  if (!botVoiceChannel) {
    console.error(
      `Vocal ${config.channels.botVoice.name} introuvable (ID: ${botVoiceChannelId}).`
    );
    return;
  }

  joinVoiceChannel({
    channelId: botVoiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator
  });
};

