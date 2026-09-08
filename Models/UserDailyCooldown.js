const mongoose = require('mongoose');

const userDailyCooldownSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  cooldown: {
    type: Number,
    default: 10 * 60 * 60 * 1000,
  },
});

userDailyCooldownSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'daily_cooldown_user_guild_unique' }
);

module.exports = mongoose.model('UserDailyCooldown', userDailyCooldownSchema);