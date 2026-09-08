const mongoose = require('mongoose');

const userRobCooldownSchema = new mongoose.Schema({
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
    default: 2 * 60 * 60 * 1000, 
  },
});

userRobCooldownSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'rob_cooldown_user_guild_unique' }
);

const UserRobCooldown = mongoose.model('UserRobCooldown', userRobCooldownSchema);

module.exports = UserRobCooldown;