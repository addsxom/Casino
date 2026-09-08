const mongoose = require('mongoose');

const userRobProtectionSchema = new mongoose.Schema({
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
    default: 0,
  },
});

userRobProtectionSchema.index(
  { userId: 1, guildId: 1 },
  { unique: true, name: 'rob_protection_user_guild_unique' }
);

module.exports = mongoose.model(
  'UserRobProtection',
  userRobProtectionSchema
);
