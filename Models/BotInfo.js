const mongoose = require('mongoose');

const botInfoSchema = new mongoose.Schema({
  botName: {
    type: String,
    default: "Kuromi-Coins 🎀"
  },
  activityType: {
    type: String,
    default: "LISTENING"
  },
  activityText: {
    type: String,
    default: "Kuromi-Coins 🎀"
  },
  activityText2: {
    type: String,
    default: "{prefix}help for {users} users!"
  },
  status: {
    type: String,
    default: "dnd"
  },
  guildId: {
    type: String,
    default: null
  }
});

const BotInfo = mongoose.model('BotInfo', botInfoSchema);

module.exports = BotInfo;
