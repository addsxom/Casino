const Discord = require("discord.js");
const bot = new Discord.Client({
    partials: [
        Discord.Partials.Message,
        Discord.Partials.Channel,
        Discord.Partials.Reaction,
        Discord.Partials.GuildMember,
        Discord.Partials.GuildScheduledEvent,
        Discord.Partials.ThreadMember,
        Discord.Partials.User

    ],
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildBans,
        Discord.GatewayIntentBits.GuildEmojisAndStickers,
        Discord.GatewayIntentBits.GuildIntegrations,
        Discord.GatewayIntentBits.GuildWebhooks,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildPresences,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.GuildMessageTyping,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.DirectMessageReactions,
        Discord.GatewayIntentBits.DirectMessageTyping,
        Discord.GatewayIntentBits.MessageContent,
        Discord.GatewayIntentBits.GuildScheduledEvents
    ],
    // ws: { properties: { browser: 'Discord iOS' } },
});

const loadCommands = require("./Loaders/loadCommands");
const loadEvents = require("./Loaders/loadEvents");

require("dotenv").config();
require(`./anti-crash.js`)()



bot.commands = new Discord.Collection();
bot.snipe = new Discord.Collection();
bot.color = "#6B6DE6",


loadCommands(bot);
loadEvents(bot);

// Pré-génère le GIF du Crash une seule fois au démarrage.
// Ainsi +crash n'a plus besoin d'attendre l'encodage.
const crashCommand = bot.commands.get('crash');

if (
    crashCommand &&
    typeof crashCommand.prepareAnimation === 'function'
) {
    try {
        crashCommand.prepareAnimation();
        console.log('Crash • animation preloaded');
    } catch (error) {
        console.error('Crash preload error:', error);
    }
}

bot.login(process.env.TOKEN);
