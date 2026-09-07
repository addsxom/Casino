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

const UserRobCooldown = mongoose.model('UserRobCooldown', userRobCooldownSchema);

module.exports = UserRobCooldown;