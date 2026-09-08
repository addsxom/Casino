const mongoose = require('mongoose');

const userWorkCooldownSchema = new mongoose.Schema({
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
    default: 60 * 60 * 1000,
  },
});

userWorkCooldownSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'work_cooldown_user_guild_unique' }
);

const userWorkCooldown = mongoose.model('userWorkCooldown', userWorkCooldownSchema);

module.exports = userWorkCooldown;
