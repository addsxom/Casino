const mongoose = require('mongoose');

const userRepCooldownSchema = new mongoose.Schema({
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
    default: 120 * 60 * 1000,
  },
});

userRepCooldownSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'rep_cooldown_user_guild_unique' }
);

const UserRepCooldown = mongoose.model('UserRepCooldown', userRepCooldownSchema);

module.exports = UserRepCooldown;
