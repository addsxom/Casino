const mongoose = require('mongoose');

const userCoinsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  coins: {
    type: Number,
    default: 0,
  },
  bank: {
    type: Number,
    default: 0,
  },
  rep: {
    type: Number,
    default: 0,
  },
  messages: {
    type: Number,
    default: 0,
  },
  messageRewardThreshold: {
    type: Number,
    default: 0,
  },
});

userCoinsSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'user_coins_user_guild_unique' }
);

module.exports = mongoose.model('UserCoins', userCoinsSchema);